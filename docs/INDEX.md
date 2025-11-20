# Documentation Index

This file provides an overview of all documentation available for Bastion Password Manager.

## For End Users

### 📖 [User-Guide.md](User-Guide.md)
**Comprehensive guide for end-users of Bastion**

Topics covered:
- Installing the desktop application (Windows, macOS, Linux)
- Creating and managing your account
- Adding, editing, and organizing passwords
- Using the browser extension for autofill
- Generating strong passwords
- Family sharing features
- Account recovery through trusted contacts
- Security best practices
- Troubleshooting common issues
- Frequently asked questions

**Target Audience**: Anyone using Bastion to manage their passwords

---

## For Developers & System Administrators

### 🔧 [README.md](README.md)
**Main technical documentation and project overview**

Topics covered:
- Features and capabilities overview
- Architecture and security model
- Technology stack
- Quick start guide for development
- Production deployment overview (VM backend + .exe distribution)
- Project structure
- Available commands
- Configuration options
- Security features and limitations
- Testing procedures
- Troubleshooting

**Target Audience**: Developers, DevOps engineers, system administrators

---

### 🚀 [DEPLOYMENT.md](DEPLOYMENT.md)
**Complete production deployment guide**

Topics covered:
- Backend server deployment (manual and automated)
- Server configuration and environment variables
- Database setup and schema management
- Process management with PM2
- Firewall and SSL/TLS configuration
- Building desktop app installers (.exe, .dmg, .AppImage)
- Configuring apps to connect to remote backend
- Distribution strategies
- Updating and maintenance procedures
- Monitoring and logging
- Backup and restore strategies
- Security checklist
- Production troubleshooting

**Target Audience**: System administrators, DevOps engineers deploying to production

---

### 📝 [CHANGELOG.md](CHANGELOG.md)
**Version history and release notes**

Topics covered:
- Current version (1.0.0) features
- Technical stack details
- Known limitations
- Planned features and improvements
- Upgrade notes

**Target Audience**: Everyone (track what's new and changed)

---

## Quick Reference

### For First-Time Setup (Development)

1. Read [README.md](README.md) → Quick Start section
2. Run `./setup.sh` or `npm run setup`
3. Start development: `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:electron`

### For Production Deployment

1. Read [DEPLOYMENT.md](DEPLOYMENT.md) thoroughly
2. Deploy backend: `npm run deploy:backend` (or manually)
3. Build desktop app: `npm run build:app` (or manually with environment variables)
4. Distribute installers to users
5. Share [User-Guide.md](User-Guide.md) with users

### For End Users

1. Read [User-Guide.md](User-Guide.md)
2. Install the desktop application
3. Create account and start using Bastion

---

## Scripts Documentation

### Development Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Setup | `./setup.sh` or `npm run setup` | First-time development environment setup |
| Clean | `npm run clean` | Remove all build artifacts and node_modules |
| Backend | `npm run dev:backend` | Start backend development server |
| Frontend | `npm run dev:frontend` | Start frontend development server |
| Desktop | `npm run dev:electron` | Launch desktop app in development mode |
| Extension | `npm run build:extension` | Build browser extension |
| Tests | `npm test` | Run all tests |

### Production Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| Deploy Backend | `npm run deploy:backend` | Automated backend deployment to VM via SSH |
| Build App | `npm run build:app` | Interactive desktop app builder with backend config |
| Build Electron | `npm run build:electron` | Build all platform installers |
| Start Backend | `npm run start:backend` | Start backend in production mode |

### Manual Script Locations

```
scripts/
├── deploy-backend.sh    # Backend deployment automation
├── build-app.sh         # Desktop app build automation
├── setup.js             # Node.js setup script
└── clean.js             # Cleanup script
```

---

## File Organization

```
Bastion-Password-Manager/
├── README.md              # Main technical documentation
├── User-Guide.md          # End-user manual
├── DEPLOYMENT.md          # Production deployment guide
├── CHANGELOG.md           # Version history
├── LICENSE.txt            # MIT license
├── setup.sh               # Development setup script
├── package.json           # Root workspace configuration
│
├── docs/                  # (This file)
│   └── INDEX.md
│
├── backend/               # Backend server code
├── frontend/              # React UI code
├── electron/              # Desktop app wrapper
├── extension/             # Browser extension
├── shared/                # Shared crypto utilities
└── scripts/               # Automation scripts
```

---

## Documentation Maintenance

### When to Update Documentation

- **README.md**: When adding/changing features, architecture, or setup process
- **User-Guide.md**: When adding user-facing features or changing workflows
- **DEPLOYMENT.md**: When deployment process changes or new infrastructure added
- **CHANGELOG.md**: For every version release or significant change

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Provide screenshots for UI-related documentation (User Guide)
- Keep table of contents updated
- Test all commands/scripts before documenting
- Use consistent formatting (Markdown)

---

## Getting Help

- **Technical Issues**: Check README.md → Troubleshooting
- **Deployment Issues**: Check DEPLOYMENT.md → Troubleshooting
- **User Issues**: Check User-Guide.md → Troubleshooting or FAQs
- **What Changed**: Check CHANGELOG.md

---

## Contributing to Documentation

When contributing to the codebase, please update relevant documentation:

1. **Code changes**: Update README.md if architecture/setup changes
2. **New features**: Update User-Guide.md for user-facing features
3. **Deployment changes**: Update DEPLOYMENT.md
4. **Releases**: Update CHANGELOG.md

---

**Last Updated**: November 21, 2025  
**Documentation Version**: 1.0.0
