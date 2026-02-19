# Contributing to Lumina

Thank you for your interest in contributing to Lumina!

## Development Setup

1. Fork and clone the repository
2. Install prerequisites (see README.md)
3. Run `./scripts/build.sh` to verify everything works

## Making Changes

### Code Style

- **Java**: Follow Google Java Style Guide
- **C++**: Follow Google C++ Style Guide  
- **TypeScript**: Use Prettier with default settings

### Commit Messages

Use conventional commits:

```
feat: add user authentication route
fix: resolve memory leak in IPC handler
docs: update getting started guide
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run the full build: `./scripts/build.sh`
4. Submit a PR with clear description

## Reporting Issues

Include:
- OS and version
- GraalVM version
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under MIT.
