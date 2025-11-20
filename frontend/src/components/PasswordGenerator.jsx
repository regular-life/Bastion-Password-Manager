import React, { useState } from 'react';
import { generatePassword } from '../api';
import { calculatePasswordStrength } from '../utils/passwordStrength';

function PasswordGenerator() {
  const [requirements, setRequirements] = useState({
    minLength: 12,
    maxLength: 20,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
    excludeAmbiguous: false,
    allowedSpecial: '',
  });

  const [nlpInput, setNlpInput] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom password strength checking
  const [customPassword, setCustomPassword] = useState('');
  const [customStrength, setCustomStrength] = useState(null);

  const handleGenerate = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await generatePassword(requirements);
      setGeneratedPassword(result.password);
      setStrength(result.strength);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseNLP = () => {
    setError('');

    if (!nlpInput.trim()) {
      setError('Please enter password requirements in natural language');
      return;
    }

    const input = nlpInput.toLowerCase();
    const parsed = {
      minLength: 12,
      maxLength: 20,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
      excludeAmbiguous: false,
      allowedSpecial: '',
    };

    // Parse length requirements
    const lengthMatch = input.match(/(\d+)\s*(?:to|-)?\s*(\d+)?\s*characters?/i);
    if (lengthMatch) {
      parsed.minLength = parseInt(lengthMatch[1]);
      if (lengthMatch[2]) {
        parsed.maxLength = parseInt(lengthMatch[2]);
      } else {
        parsed.maxLength = parsed.minLength;
      }
    }

    // Exact length
    const exactMatch = input.match(/exactly\s+(\d+)/i);
    if (exactMatch) {
      parsed.minLength = parseInt(exactMatch[1]);
      parsed.maxLength = parsed.minLength;
    }

    // At least
    const atLeastMatch = input.match(/at least\s+(\d+)/i);
    if (atLeastMatch) {
      parsed.minLength = parseInt(atLeastMatch[1]);
    }

    // Character types
    if (input.includes('no uppercase') || input.includes('without uppercase')) {
      parsed.requireUppercase = false;
    }
    if (input.includes('no lowercase') || input.includes('without lowercase')) {
      parsed.requireLowercase = false;
    }
    if (input.includes('no numbers') || input.includes('without numbers') || input.includes('no digits')) {
      parsed.requireNumbers = false;
    }
    if (input.includes('no special') || input.includes('without special')) {
      parsed.requireSpecial = false;
    }

    // Must contain
    if (input.includes('must contain uppercase') || input.includes('require uppercase')) {
      parsed.requireUppercase = true;
    }
    if (input.includes('must contain lowercase') || input.includes('require lowercase')) {
      parsed.requireLowercase = true;
    }
    if (input.includes('must contain numbers') || input.includes('require numbers') || input.includes('must contain digits')) {
      parsed.requireNumbers = true;
    }
    if (input.includes('must contain special') || input.includes('require special')) {
      parsed.requireSpecial = true;
    }

    // Exclude ambiguous
    if (input.includes('no ambiguous') || input.includes('exclude ambiguous')) {
      parsed.excludeAmbiguous = true;
    }

    // Allowed special characters
    const specialMatch = input.match(/only\s+(?:these\s+)?special\s+(?:characters?)?:\s*([!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i);
    if (specialMatch) {
      parsed.allowedSpecial = specialMatch[1];
    }

    setRequirements(parsed);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
  };

  const copyCustomToClipboard = () => {
    navigator.clipboard.writeText(customPassword);
  };

  const handleCustomPasswordChange = (e) => {
    const pwd = e.target.value;
    setCustomPassword(pwd);
    setCustomStrength(calculatePasswordStrength(pwd));
  };

  const getStrengthColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    if (score >= 40) return '#FF9800';
    return '#F44336';
  };

  const getStrengthLabel = (score) => {
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Weak';
  };

  return (
    <div className="password-generator">
      <h2>Password Generator</h2>

      {error && <div className="error">{error}</div>}

      <div className="section">
        <h3>Natural Language Requirements (Optional)</h3>
        <p className="info">
          Example: "12-16 characters with uppercase, lowercase, numbers, and special characters"
        </p>
        <div className="form-group">
          <textarea
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            placeholder="Describe your password requirements in plain English..."
            rows={3}
            style={{ width: '100%', padding: '10px', fontFamily: 'Arial, sans-serif' }}
          />
        </div>
        <button onClick={parseNLP}>Parse Requirements</button>
      </div>

      <div className="section">
        <h3>Password Requirements</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Min Length</label>
            <input
              type="number"
              value={requirements.minLength}
              onChange={(e) => setRequirements({ ...requirements, minLength: parseInt(e.target.value) })}
              min="1"
              max="100"
            />
          </div>

          <div className="form-group">
            <label>Max Length</label>
            <input
              type="number"
              value={requirements.maxLength}
              onChange={(e) => setRequirements({ ...requirements, maxLength: parseInt(e.target.value) })}
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={requirements.requireUppercase}
              onChange={(e) => setRequirements({ ...requirements, requireUppercase: e.target.checked })}
            />
            Require Uppercase (A-Z)
          </label>

          <label>
            <input
              type="checkbox"
              checked={requirements.requireLowercase}
              onChange={(e) => setRequirements({ ...requirements, requireLowercase: e.target.checked })}
            />
            Require Lowercase (a-z)
          </label>

          <label>
            <input
              type="checkbox"
              checked={requirements.requireNumbers}
              onChange={(e) => setRequirements({ ...requirements, requireNumbers: e.target.checked })}
            />
            Require Numbers (0-9)
          </label>

          <label>
            <input
              type="checkbox"
              checked={requirements.requireSpecial}
              onChange={(e) => setRequirements({ ...requirements, requireSpecial: e.target.checked })}
            />
            Require Special Characters
          </label>

          <label>
            <input
              type="checkbox"
              checked={requirements.excludeAmbiguous}
              onChange={(e) => setRequirements({ ...requirements, excludeAmbiguous: e.target.checked })}
            />
            Exclude Ambiguous Characters (0, O, l, 1, etc.)
          </label>
        </div>

        <div className="form-group">
          <label>Allowed Special Characters (optional)</label>
          <input
            type="text"
            value={requirements.allowedSpecial}
            onChange={(e) => setRequirements({ ...requirements, allowedSpecial: e.target.value })}
            placeholder="e.g., !@#$%"
          />
          <p className="info">Leave empty to allow all special characters</p>
        </div>

        <button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Password'}
        </button>
      </div>

      {generatedPassword && (
        <div className="section">
          <h3>Generated Password</h3>
          <div className="password-output">
            <input
              type="text"
              value={generatedPassword}
              readOnly
              style={{ flex: 1, fontSize: '18px', fontFamily: 'monospace' }}
            />
            <button onClick={copyToClipboard}>Copy</button>
          </div>

          {strength && (
            <div className="strength-meter">
              <div className="strength-label">
                Strength: <strong style={{ color: getStrengthColor(strength.score) }}>
                  {getStrengthLabel(strength.score)} ({strength.score}/100)
                </strong>
              </div>
              <div className="strength-bar">
                <div
                  className="strength-fill"
                  style={{
                    width: `${strength.score}%`,
                    background: getStrengthColor(strength.score),
                  }}
                ></div>
              </div>
              <div className="strength-feedback">
                <p><strong>Entropy:</strong> {strength.entropy.toFixed(2)} bits</p>
                <p><strong>Time to crack:</strong> {strength.crackTime}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Password Strength Checker */}
      <div className="section">
        <h3>Check Custom Password Strength</h3>
        <p className="info">
          Enter any password to analyze its strength and get suggestions for improvement.
        </p>
        <div className="form-group">
          <label>Your Password</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={customPassword}
              onChange={handleCustomPasswordChange}
              placeholder="Enter a password to check its strength..."
              style={{ flex: 1, fontSize: '16px', fontFamily: 'monospace' }}
            />
            {customPassword && (
              <button onClick={copyCustomToClipboard}>Copy</button>
            )}
          </div>
        </div>

        {customStrength && customPassword && (
          <div className="strength-meter">
            <div className="strength-label">
              Strength: <strong style={{ color: customStrength.color }}>
                {customStrength.label} ({customStrength.score}/100)
              </strong>
            </div>
            <div className="strength-bar">
              <div
                className="strength-fill"
                style={{
                  width: `${customStrength.score}%`,
                  background: customStrength.color,
                  transition: 'width 0.3s ease, background 0.3s ease'
                }}
              ></div>
            </div>
            {customStrength.feedback && customStrength.feedback.length > 0 && (
              <div className="strength-feedback">
                <p><strong>Suggestions:</strong></p>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  {customStrength.feedback.map((item, index) => (
                    <li key={index} style={{ marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PasswordGenerator;
