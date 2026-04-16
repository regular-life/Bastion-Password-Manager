#include <napi.h>
#include <sodium.h>
#include <unordered_map>
#include <vector>
#include <string>

using namespace Napi;

// Securely store keys in C++ memory
std::vector<uint8_t> master_key;
std::unordered_map<uint32_t, std::vector<uint8_t>> key_store;
uint32_t next_key_id = 1;

// Helper to Base64 encode
inline std::string base64_encode(const unsigned char* data, size_t len) {
    size_t out_len = sodium_base64_ENCODED_LEN(len, sodium_base64_VARIANT_ORIGINAL);
    char* b64 = new char[out_len];
    sodium_bin2base64(b64, out_len, data, len, sodium_base64_VARIANT_ORIGINAL);
    std::string result(b64);
    delete[] b64;
    return result;
}

// Helper to Base64 decode
inline std::vector<uint8_t> base64_decode(const std::string& b64) {
    size_t b64_len = b64.length();
    size_t max_out_len = b64_len; // Conservative
    std::vector<uint8_t> out(max_out_len);
    size_t out_len;
    if (sodium_base642bin(out.data(), max_out_len, b64.c_str(), b64_len, nullptr, &out_len, nullptr, sodium_base64_VARIANT_ORIGINAL) != 0) {
        return {}; // Error
    }
    out.resize(out_len);
    return out;
}

// 1. deriveMasterKey
Value DeriveMasterKey(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Error::New(env, "String password and saltBase64 expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    std::string password = info[0].As<String>();
    std::string saltBase64 = info[1].As<String>();

    // JS flow: atob() decoding of saltBase64.
    // In naive JS: the binary string is converted to charcodes.
    std::vector<uint8_t> salt(saltBase64.length());
    // Wait, saltBase64 is currently processed using atob() in JS which decodes standard base64 to binary string.
    std::vector<uint8_t> decoded_salt = base64_decode(saltBase64);
    
    // JS: combined = passwordBytes + saltBytes
    std::vector<uint8_t> combined(password.length() + decoded_salt.size());
    memcpy(combined.data(), password.c_str(), password.length());
    memcpy(combined.data() + password.length(), decoded_salt.data(), decoded_salt.size());

    master_key.resize(crypto_generichash_BYTES);
    crypto_generichash(master_key.data(), master_key.size(),
                       combined.data(), combined.size(),
                       nullptr, 0);

    // Wipe combined
    sodium_memzero(combined.data(), combined.size());
    // We do NOT return the key
    return Napi::Boolean::New(env, true);
}

// clearMasterKey
Value ClearMasterKey(const CallbackInfo& info) {
    if (!master_key.empty()) {
        sodium_memzero(master_key.data(), master_key.size());
        master_key.clear();
    }
    // Wipe all regular keys too
    for (auto& pair : key_store) {
        sodium_memzero(pair.second.data(), pair.second.size());
    }
    key_store.clear();
    next_key_id = 1;
    return Napi::Boolean::New(info.Env(), true);
}

// generateKey
Value GenerateKey(const CallbackInfo& info) {
    std::vector<uint8_t> new_key(32);
    randombytes_buf(new_key.data(), new_key.size());
    uint32_t id = next_key_id++;
    key_store[id] = std::move(new_key);

    Object result = Object::New(info.Env());
    result.Set("_isHandle", true);
    result.Set("id", id);
    return result;
}

// get_key_from_handle helper
const std::vector<uint8_t>* GetKeyFromArg(const Value& arg) {
    if (arg.IsObject()) {
        Object obj = arg.As<Object>();
        if (obj.Has("_isHandle") && obj.Get("_isHandle").ToBoolean().Value()) {
            uint32_t id = obj.Get("id").ToNumber().Uint32Value();
            auto it = key_store.find(id);
            if (it != key_store.end()) return &it->second;
        }
    } else if (arg.IsString()) {
        std::string s = arg.As<String>();
        if (s == "MASTER_KEY") {
            if (master_key.size() == 32) return &master_key;
        }
    }
    return nullptr;
}

// encrypt
Value Encrypt(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 2) {
        Error::New(env, "Expected plaintext and key handle").ThrowAsJavaScriptException();
        return env.Null();
    }

    const std::vector<uint8_t>* key = GetKeyFromArg(info[1]);
    if (!key) {
        Error::New(env, "Invalid key handle").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<uint8_t> plaintext;
    if (info[0].IsString()) {
        std::string s = info[0].As<String>();
        plaintext.assign(s.begin(), s.end());
    } else if (info[0].IsObject()) { // Encrypting a Key Handle!
        const std::vector<uint8_t>* target_key = GetKeyFromArg(info[0]);
        if (!target_key) {
            Error::New(env, "Invalid target key handle to encrypt").ThrowAsJavaScriptException();
            return env.Null();
        }
        plaintext = *target_key;
    } else if (info[0].IsBuffer()) {
        Buffer<uint8_t> buf = info[0].As<Buffer<uint8_t>>();
        plaintext.assign(buf.Data(), buf.Data() + buf.Length());
    } else {
        Error::New(env, "Invalid plaintext type").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<uint8_t> nonce(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    randombytes_buf(nonce.data(), nonce.size());

    std::vector<uint8_t> ciphertext(plaintext.size() + crypto_aead_xchacha20poly1305_ietf_ABYTES);
    unsigned long long ciphertext_len;

    crypto_aead_xchacha20poly1305_ietf_encrypt(
        ciphertext.data(), &ciphertext_len,
        plaintext.data(), plaintext.size(),
        nullptr, 0,
        nullptr,
        nonce.data(),
        key->data()
    );
    ciphertext.resize(ciphertext_len);

    Object result = Object::New(env);
    result.Set("nonce", base64_encode(nonce.data(), nonce.size()));
    result.Set("ciphertext", base64_encode(ciphertext.data(), ciphertext.size()));

    sodium_memzero(plaintext.data(), plaintext.size());

    return result;
}

// decrypt
Value Decrypt(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 3) {
        Error::New(env, "Expected ciphertextBase64, nonceBase64, key handle").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string ciphertextBase64 = info[0].As<String>();
    std::string nonceBase64 = info[1].As<String>();
    const std::vector<uint8_t>* key = GetKeyFromArg(info[2]);

    if (!key) {
        Error::New(env, "Invalid key handle").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool returnAsHandle = false;
    if (info.Length() >= 4 && info[3].IsBoolean()) {
        returnAsHandle = info[3].As<Boolean>().Value();
    }

    std::vector<uint8_t> ciphertext = base64_decode(ciphertextBase64);
    std::vector<uint8_t> nonce = base64_decode(nonceBase64);

    if (ciphertext.empty() || nonce.empty()) {
        Error::New(env, "Base64 decode failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<uint8_t> plaintext(ciphertext.size());
    unsigned long long plaintext_len;

    if (crypto_aead_xchacha20poly1305_ietf_decrypt(
        plaintext.data(), &plaintext_len,
        nullptr,
        ciphertext.data(), ciphertext.size(),
        nullptr, 0,
        nonce.data(),
        key->data()
    ) != 0) {
        Error::New(env, "Decryption failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    plaintext.resize(plaintext_len);

    if (returnAsHandle) {
        uint32_t id = next_key_id++;
        key_store[id] = plaintext; // plaintext gets moved/copied
        Object result = Object::New(env);
        result.Set("_isHandle", true);
        result.Set("id", id);
        sodium_memzero(plaintext.data(), plaintext.size());
        return result;
    }

    // Return as Buffer (for display in UI)
    Buffer<uint8_t> resultBuf = Buffer<uint8_t>::Copy(env, plaintext.data(), plaintext.size());
    sodium_memzero(plaintext.data(), plaintext.size());
    return resultBuf;
}

Value DestroyKey(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() >= 1 && info[0].IsObject()) {
        Object obj = info[0].As<Object>();
        if (obj.Has("_isHandle") && obj.Get("_isHandle").ToBoolean().Value()) {
            uint32_t id = obj.Get("id").ToNumber().Uint32Value();
            auto it = key_store.find(id);
            if (it != key_store.end()) {
                sodium_memzero(it->second.data(), it->second.size());
                key_store.erase(it);
                return Napi::Boolean::New(env, true);
            }
        }
    }
    return Napi::Boolean::New(env, false);
}

// generateKeyPair
Value GenerateKeyPair(const CallbackInfo& info) {
    Env env = info.Env();
    std::vector<uint8_t> pk(crypto_box_PUBLICKEYBYTES);
    std::vector<uint8_t> sk(crypto_box_SECRETKEYBYTES);
    crypto_box_keypair(pk.data(), sk.data());

    uint32_t id = next_key_id++;
    key_store[id] = std::move(sk);

    Object result = Object::New(env);
    result.Set("publicKey", Buffer<uint8_t>::Copy(env, pk.data(), pk.size()));
    
    Object skHandle = Object::New(env);
    skHandle.Set("_isHandle", true);
    skHandle.Set("id", id);
    result.Set("privateKey", skHandle);
    
    return result;
}

// encryptForPublicKey (sealed box)
Value EncryptForPublicKey(const CallbackInfo& info) {
    Env env = info.Env();
    
    const std::vector<uint8_t>* target_key = nullptr;
    std::vector<uint8_t> plaintext;
    if (info[0].IsObject()) {
        target_key = GetKeyFromArg(info[0]);
    }

    if (target_key) {
        plaintext = *target_key;
    } else if (info[0].IsBuffer()) {
        Buffer<uint8_t> buf = info[0].As<Buffer<uint8_t>>();
        plaintext.assign(buf.Data(), buf.Data() + buf.Length());
    } else if (info[0].IsString()) {
        std::string s = info[0].As<String>();
        plaintext.assign(s.begin(), s.end());
    } else {
        Error::New(env, "Invalid plaintext").ThrowAsJavaScriptException();
        return env.Null();
    }

    Buffer<uint8_t> pkBuf = info[1].As<Buffer<uint8_t>>();
    std::vector<uint8_t> ciphertext(plaintext.size() + crypto_box_SEALBYTES);

    crypto_box_seal(ciphertext.data(), plaintext.data(), plaintext.size(), pkBuf.Data());
    
    sodium_memzero(plaintext.data(), plaintext.size());

    return Napi::String::New(env, base64_encode(ciphertext.data(), ciphertext.size()));
}

// decryptWithPrivateKey
Value DecryptWithPrivateKey(const CallbackInfo& info) {
    Env env = info.Env();
    std::string ciphertextBase64 = info[0].As<String>();
    Buffer<uint8_t> pkBuf = info[1].As<Buffer<uint8_t>>();
    const std::vector<uint8_t>* sk = GetKeyFromArg(info[2]);

    std::vector<uint8_t> ciphertext = base64_decode(ciphertextBase64);
    std::vector<uint8_t> plaintext(ciphertext.size() - crypto_box_SEALBYTES);

    if (crypto_box_seal_open(plaintext.data(), ciphertext.data(), ciphertext.size(), pkBuf.Data(), sk->data()) != 0) {
        Error::New(env, "Decryption failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Default to returning a handle since this decrypts Master Keys usually
    uint32_t id = next_key_id++;
    key_store[id] = plaintext;
    
    Object result = Object::New(env);
    result.Set("_isHandle", true);
    result.Set("id", id);
    
    sodium_memzero(plaintext.data(), plaintext.size());
    return result;
}

Object Init(Env env, Object exports) {
    if (sodium_init() < 0) {
        Error::New(env, "libsodium initialization failed").ThrowAsJavaScriptException();
    }
    exports.Set("deriveMasterKey", Function::New(env, DeriveMasterKey));
    exports.Set("clearMasterKey", Function::New(env, ClearMasterKey));
    exports.Set("generateKey", Function::New(env, GenerateKey));
    exports.Set("encrypt", Function::New(env, Encrypt));
    exports.Set("decrypt", Function::New(env, Decrypt));
    exports.Set("destroyKey", Function::New(env, DestroyKey));
    exports.Set("generateKeyPair", Function::New(env, GenerateKeyPair));
    exports.Set("encryptForPublicKey", Function::New(env, EncryptForPublicKey));
    exports.Set("decryptWithPrivateKey", Function::New(env, DecryptWithPrivateKey));
    return exports;
}

NODE_API_MODULE(bastion_crypto, Init)
