/**
 * Calculate password strength score and provide feedback
 * Returns an object with score (0-100), label, and color
 */
export function calculatePasswordStrength(password) {
    if (!password) {
        return {
            score: 0,
            label: 'No password',
            color: '#666',
            feedback: []
        };
    }

    let score = 0;
    const feedback = [];
    const length = password.length;

    // Length scoring (up to 30 points)
    if (length >= 12) {
        score += 30;
    } else if (length >= 8) {
        score += 20;
        feedback.push('Consider using at least 12 characters');
    } else if (length >= 6) {
        score += 10;
        feedback.push('Use at least 8 characters');
    } else {
        feedback.push('Password is too short');
    }

    // Character variety (up to 40 points)
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
    score += varietyCount * 10;

    if (!hasLowercase) feedback.push('Add lowercase letters');
    if (!hasUppercase) feedback.push('Add uppercase letters');
    if (!hasNumbers) feedback.push('Add numbers');
    if (!hasSpecial) feedback.push('Add special characters');

    // Complexity patterns (up to 30 points)
    // Check for common patterns and deduct points
    const commonPatterns = [
        /^[a-z]+$/i,           // Only letters
        /^\d+$/,               // Only numbers
        /^(.)\1+$/,            // Repeated characters
        /^(12345|qwerty|password|abc123)/i  // Common sequences
    ];

    let patternPenalty = 0;
    commonPatterns.forEach(pattern => {
        if (pattern.test(password)) {
            patternPenalty += 10;
        }
    });

    // Sequential characters check
    let sequentialCount = 0;
    for (let i = 0; i < password.length - 2; i++) {
        const charCode1 = password.charCodeAt(i);
        const charCode2 = password.charCodeAt(i + 1);
        const charCode3 = password.charCodeAt(i + 2);

        if (charCode2 === charCode1 + 1 && charCode3 === charCode2 + 1) {
            sequentialCount++;
        }
    }

    if (sequentialCount > 0) {
        patternPenalty += Math.min(15, sequentialCount * 5);
        feedback.push('Avoid sequential characters');
    }

    // Repetition check
    const uniqueChars = new Set(password).size;
    const repetitionRatio = uniqueChars / length;

    if (repetitionRatio < 0.5) {
        patternPenalty += 10;
        feedback.push('Use more varied characters');
    }

    // Add complexity bonus if no patterns detected
    if (patternPenalty === 0) {
        score += 30;
    } else {
        score = Math.max(0, score - patternPenalty);
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Determine label and color
    let label, color;
    if (score >= 80) {
        label = 'Strong';
        color = '#4CAF50';
    } else if (score >= 60) {
        label = 'Good';
        color = '#8BC34A';
    } else if (score >= 40) {
        label = 'Fair';
        color = '#FFC107';
    } else if (score >= 20) {
        label = 'Weak';
        color = '#FF9800';
    } else {
        label = 'Very Weak';
        color = '#F44336';
    }

    return {
        score,
        label,
        color,
        feedback: feedback.slice(0, 3) // Only show top 3 feedback items
    };
}

/**
 * Get a simple color for a strength score
 */
export function getStrengthColor(score) {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    if (score >= 20) return '#FF9800';
    return '#F44336';
}

/**
 * Get a simple label for a strength score
 */
export function getStrengthLabel(score) {
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
}
