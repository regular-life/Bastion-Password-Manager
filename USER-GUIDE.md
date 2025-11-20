# Bastion Password Manager - User Guide

Welcome to Bastion! This guide will help you get started with your secure password manager.

## Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [Managing Your Vault](#managing-your-vault)
4. [Browser Extension](#browser-extension)
5. [Password Generator](#password-generator)
6. [Family Sharing](#family-sharing)
7. [Account Recovery](#account-recovery)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQs](#faqs)

---

## Installation

### Desktop Application

#### Windows
1. Download `Bastion Setup.exe` from your administrator or download link
2. Double-click the installer
3. Follow the installation wizard
4. Launch Bastion from the Start menu or desktop shortcut

#### macOS
1. Download `Bastion.dmg`
2. Open the DMG file
3. Drag Bastion to your Applications folder
4. Open Bastion from Applications

#### Linux
1. Download `Bastion.AppImage`
2. Make it executable: `chmod +x Bastion.AppImage`
3. Run it: `./Bastion.AppImage`

### Browser Extension (Optional)

1. Open Chrome or Edge browser
2. Download the extension from the Chrome Web Store (or get the extension files)
3. If loading manually:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder
4. The Bastion icon will appear in your browser toolbar

---

## Getting Started

### Creating Your Account

1. **Launch Bastion** desktop application
2. Click **"Sign Up"**
3. Enter your **email address**
4. Create a **strong master password**
   - Use at least 12 characters
   - Mix uppercase, lowercase, numbers, and symbols
   - Make it memorable but unique
   - ⚠️ **IMPORTANT**: This password cannot be recovered if forgotten!
5. Click **"Create Account"**

You're now ready to start using Bastion!

### Your First Login

1. **Launch Bastion**
2. Enter your **email** and **master password**
3. Click **"Log In"**
4. Your vault will unlock

**Tip**: The desktop app will keep you logged in for 24 hours by default.

---

## Managing Your Vault

### Adding a Password

1. In the Bastion app, go to the **"Vault"** section
2. Click **"Add Entry"**
3. Fill in the details:
   - **Website URL**: `https://example.com`
   - **Username**: Your username or email
   - **Password**: Your password (or generate a new one)
   - **Notes** (optional): Additional information
4. Click **"Save"**

Your password is now encrypted and stored securely!

### Editing a Password

1. Find the entry in your vault
2. Click on it to view details
3. Click **"Edit"**
4. Make your changes
5. Click **"Save"**

### Deleting a Password

1. Find the entry in your vault
2. Click on it to view details
3. Click **"Delete"**
4. Confirm deletion

⚠️ **Warning**: Deleted passwords cannot be recovered.

### Searching Your Vault

Use the search bar at the top to quickly find entries by:
- Website name
- URL
- Username

---

## Browser Extension

The browser extension allows automatic password filling on websites.

### Setup

1. Install the extension (see [Installation](#installation))
2. **Keep the Bastion desktop app running and logged in**
3. Click the Bastion extension icon
4. Click **"Unlock Vault"**

The extension will connect to your desktop app and sync your vault.

### Using Autofill

1. **Navigate to a login page** (e.g., facebook.com/login)
2. **Look for the password field**
3. A **"Fill Password"** button will appear next to it
4. Click the button
5. Your credentials will be filled automatically

**Alternative Method:**
- Click the extension icon
- Select the credential you want to use
- Click "Autofill"

### Extension Auto-Lock

For security, the extension automatically locks after:
- 15 minutes of inactivity
- Closing the browser
- Logging out of the desktop app

Simply unlock it again by clicking **"Unlock Vault"** in the extension.

---

## Password Generator

Bastion includes a smart password generator that creates strong, site-compliant passwords.

### Using the Generator

#### Method 1: In the Desktop App

1. When adding or editing an entry, click **"Generate Password"**
2. Review the generated password
3. Adjust settings if needed:
   - Length (12-64 characters)
   - Include uppercase letters
   - Include lowercase letters
   - Include numbers
   - Include symbols
4. Click **"Use This Password"**

#### Method 2: On Websites (via Extension)

1. Navigate to a sign-up or password change page
2. Click on the password field
3. A **"Generate Password"** button appears
4. Click it to see a generated password
5. The generator will automatically detect site requirements
6. Click **"Use This Password"**
7. Save the entry to your vault when prompted

### Password Strength Indicator

- **Weak** (Red): Too short or simple
- **Fair** (Orange): Decent but could be better
- **Good** (Yellow): Strong enough
- **Excellent** (Green): Very strong

Always aim for "Good" or "Excellent" strength.

---

## Family Sharing

Share passwords with family members securely—they can use the passwords without seeing them!

### Understanding Family Sharing

- **Owner**: You create the family and share credentials
- **Members**: Family members can autofill shared passwords but **cannot view them**
- **Security**: Shared passwords are never visible to members—only autofilled

### Creating a Family

1. In Bastion, go to **"Families"** section
2. Click **"Create Family"**
3. Enter a family name (e.g., "Smith Family")
4. Click **"Create"**

You are now the owner of this family!

### Inviting Family Members

1. Open your family
2. Click **"Create Invite Link"**
3. Set expiration (default: 7 days)
4. **Copy the link** and send it to your family member
   - Via email, messaging app, etc.
5. They click the link and accept the invite

**Note**: Invite links expire and can only be used once.

### Sharing a Password

1. Go to your **"Vault"**
2. Select the credential you want to share
3. Click **"Share with Family"**
4. Choose which family to share with
5. **(Optional)** Set allowed domains
   - Leave empty to allow all domains
   - Or specify: `netflix.com`, `facebook.com`
6. Click **"Share"**

The password is now shared! Family members can autofill it.

### Using Shared Passwords (As a Member)

1. Install the browser extension and log in
2. Navigate to the login page (e.g., netflix.com)
3. The extension detects the shared credential
4. Click **"Autofill Shared"**
5. Credentials are filled automatically

**What You'll See:**
- Website name and URL
- Username (visible)
- Password: `••••••••••` (masked)

**What You Can Do:**
- Autofill the password

**What You Cannot Do:**
- View the actual password
- Copy the password
- Edit the password
- Share it with others

### Viewing Who Used Your Shared Passwords

1. Go to **"Families"** → Select your family
2. Click **"Audit Log"**
3. View recent activity:
   - Who requested autofill
   - Which password
   - Which website
   - When (timestamp)
   - Success or failure

### Stopping Sharing

1. Go to **"Families"** → Select your family
2. Click **"Shared Credentials"**
3. Find the credential
4. Click **"Unshare"** or **"Revoke"**
5. Confirm

Members will immediately lose access to this password.

### Removing a Family Member

1. Go to **"Families"** → Select your family
2. Click **"Members"**
3. Select the member to remove
4. Click **"Remove from Family"**
5. Confirm

They will lose access to all shared credentials immediately.

---

## Account Recovery

If you forget your master password, you can recover your account through trusted contacts.

### Setting Up Account Recovery

#### Step 1: Add Trusted Contacts

1. Go to **"Account Recovery"** section
2. Click **"Add Trusted Contact"**
3. Choose a contact from:
   - Your family members (if in a family)
   - Other Bastion users (by email)
4. Click **"Add"**

**Recommendation**: Add 2-3 trusted contacts for redundancy.

#### Step 2: They Accept

1. Your contact receives a notification or request
2. They review and accept being your trusted contact
3. System encrypts your master key for them

**Note**: Trusted contacts can help you recover but **cannot access your vault** unless you request recovery.

### Recovering Your Account

If you forget your master password:

#### Step 1: Initiate Recovery

1. On the login screen, click **"Forgot Password?"**
2. Enter your **email address**
3. Select a **trusted contact** from the list
4. Click **"Request Recovery"**

#### Step 2: Wait for Approval

1. Your trusted contact will receive a notification
2. They log into Bastion
3. They go to **"Account Recovery"** section
4. They see your request and click **"Approve"**
5. They enter their master password to confirm

#### Step 3: Complete Recovery

1. Check the status in your recovery request
2. Once approved, click **"Complete Recovery"**
3. Enter a **new master password**
4. Click **"Reset Password"**

Your vault is now accessible with your new password!

**Important Notes:**
- The trusted contact **cannot access your vault**
- They only approve the recovery
- You must set a **new** master password
- Your vault data remains encrypted throughout

---

## Security Best Practices

### Master Password

✅ **DO:**
- Use a unique password (not used elsewhere)
- Make it at least 12 characters
- Use a passphrase: "correct-horse-battery-staple"
- Write it down and store it securely (physical safe)
- Consider using a password manager to... wait, you're already using one!

❌ **DON'T:**
- Use common passwords
- Reuse passwords from other accounts
- Share your master password with anyone
- Store it digitally (in emails, notes, etc.)

### Vault Passwords

✅ **DO:**
- Use the password generator for new passwords
- Use unique passwords for each site
- Use the maximum allowed length
- Enable all character types (uppercase, lowercase, numbers, symbols)
- Update old/weak passwords regularly

❌ **DON'T:**
- Reuse passwords across sites
- Use personal information (birthdays, names)
- Use simple patterns (123456, qwerty)

### Family Sharing

✅ **DO:**
- Only share with people you completely trust
- Review audit logs regularly
- Use domain restrictions when possible
- Revoke access when someone leaves
- Set up multiple trusted contacts for recovery

❌ **DON'T:**
- Share your master password
- Share credentials you don't want accessed
- Ignore unusual activity in audit logs
- Trust screenshots of "shared" passwords

### General Security

✅ **DO:**
- Lock Bastion when stepping away
- Log out on shared computers
- Keep the desktop app updated
- Use the browser extension auto-lock
- Set up account recovery before you need it

❌ **DON'T:**
- Leave Bastion unlocked and unattended
- Use Bastion on untrusted/public computers
- Ignore security warnings or prompts
- Share invite links publicly

---

## Troubleshooting

### I Forgot My Master Password

See [Account Recovery](#account-recovery) section. If you didn't set up trusted contacts, **your account cannot be recovered**. This is by design for security.

### Extension Won't Connect

**Solution:**
1. Make sure the Bastion desktop app is **running**
2. Make sure you're **logged in** to the desktop app
3. Click the extension icon → **"Unlock Vault"**
4. If still failing, restart the desktop app
5. Reload the extension: `chrome://extensions/` → Click reload

### Autofill Not Working

**Troubleshooting Steps:**
1. Is the extension unlocked? → Click extension icon and unlock
2. Is the entry in your vault? → Check the vault
3. Does the URL match? → Entry URL should match the site
4. Is the desktop app running? → Start the desktop app
5. Is the page fully loaded? → Wait for the page to load completely

### "Cannot Connect to Server" Error

**Possible Causes:**
- Backend server is down
- Network connection issue
- Firewall blocking connection

**Solution:**
1. Check your internet connection
2. Contact your system administrator
3. Wait a few minutes and try again

### Shared Password Not Showing Up

**For Members:**
1. Make sure you accepted the family invite
2. Refresh your vault (log out and log back in)
3. Check with the owner that they shared it

**For Owners:**
1. Verify you clicked "Share"
2. Check the family has the right members
3. Check audit logs for any errors

### Desktop App Won't Start

**Windows:**
1. Try running as Administrator
2. Check Windows Defender didn't block it
3. Reinstall the application

**macOS:**
1. Go to System Preferences → Security & Privacy
2. Allow Bastion to run
3. If still failing, reinstall

**Linux:**
1. Make sure the AppImage is executable: `chmod +x Bastion.AppImage`
2. Install FUSE if needed: `sudo apt install fuse`
3. Try extracting and running directly

---

## FAQs

### General Questions

**Q: Is my data safe?**  
A: Yes! Your master key never leaves your device. All data is encrypted before being sent to the server. Even if the server is compromised, your passwords remain secure.

**Q: Can Bastion employees see my passwords?**  
A: No. We use zero-knowledge encryption. Your passwords are encrypted on your device, and we never have access to your master key.

**Q: What happens if I lose my master password?**  
A: If you set up trusted contacts, you can recover your account. Otherwise, there is no way to recover your account—this is by design for security.

**Q: Can I use Bastion offline?**  
A: The desktop app requires internet connection to sync. However, once synced, you can view (but not edit) your vault offline.

**Q: How much does Bastion cost?**  
A: Contact your administrator for pricing/licensing information.

### Family Sharing

**Q: Can family members see my passwords?**  
A: No! Family members can only autofill shared passwords. They cannot view, copy, or export them.

**Q: Can family members share credentials they received?**  
A: No. Only the owner can share credentials.

**Q: How many family members can I have?**  
A: There is no hard limit, but we recommend keeping families small and trustworthy.

**Q: Can a shared password be used on any website?**  
A: Only if you allow it. You can restrict shared passwords to specific domains when sharing.

**Q: Will I know if a family member uses a shared password?**  
A: Yes! Every autofill request is logged in the audit log with timestamp and website.

### Technical Questions

**Q: What encryption does Bastion use?**  
A: We use XChaCha20-Poly1305 for encryption and Argon2id for password hashing.

**Q: Where is my data stored?**  
A: Encrypted data is stored on the backend server. Your master key and decrypted passwords only exist on your device.

**Q: Can I export my passwords?**  
A: This feature is coming soon. Contact your administrator for manual export if needed.

**Q: Does Bastion work on mobile?**  
A: Not yet. Mobile apps are planned for a future release.

**Q: Can I import passwords from another password manager?**  
A: This feature is coming soon.

### Browser Extension

**Q: Does the extension work offline?**  
A: No, it needs to connect to the desktop app, which requires internet.

**Q: Can I use the extension without the desktop app?**  
A: No, the extension requires the desktop app to be running and logged in.

**Q: Which browsers are supported?**  
A: Chrome, Edge, and Brave (Chromium-based). Firefox support coming soon.

**Q: Does the extension track my browsing?**  
A: No. The extension only activates on pages with login forms and doesn't track your activity.

---

## Getting Help

If you need additional assistance:

- **Documentation**: Reread this guide and the README
- **System Administrator**: Contact your IT department or Bastion administrator
- **Email Support**: support@bastion-pm.example.com (update with actual contact)
- **Report Bugs**: Contact your administrator with details

---

## Tips for Success

1. **Set up trusted contacts immediately** after creating your account
2. **Use the password generator** for all new accounts
3. **Review shared credentials** weekly if you're a family owner
4. **Keep the desktop app running** for seamless browser extension usage
5. **Update passwords regularly**, especially after security breaches
6. **Lock your vault** when stepping away from your computer
7. **Never share your master password** with anyone, including family

---

**Welcome to secure password management with Bastion!** 🔒

*Version 1.0 | Last Updated: November 2025*
