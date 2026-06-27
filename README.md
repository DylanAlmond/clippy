# Clippy

![Screenshot](./screenshot.png)

Remember me?

I'm Clippy. I used to help people write letters. Now I watch your screen and make unsolicited comments about what you're doing.

## What does Clippy actually do?

Every so often, Clippy takes a look at your screen and reacts to whatever you're doing.

You might see things like:

> "It looks like you are simply staring at a screen. Perhaps I could explain how to actually _do_ something?"

> "Another YouTube tab? Research, I'm sure."

> "That TODO comment has been there for a while, hasn't it?"

> "You seem to have opened seventeen documentation pages instead of reading the first one."

He means well, probably.

## Privacy

Everything happens locally:

- Screenshots never leave your computer.
- The AI runs through your local LM Studio server.

The only thing watching you is Clippy.

## Setup

### 1. Install LM Studio

Download and install LM Studio:

https://lmstudio.ai

### 2. Download a model

Search for and download:

```text
google/gemma-4-e4b
```

### 3. Start the API server

In LM Studio:

```text
Developer → Local Server → Start Server
```

Leave the server running while using Clippy.

## Installation

### 1. Install Rust

Tauri requires Rust and Cargo.

Install Rust using rustup:

**macOS / Linux**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Windows**

Download and run:

https://rustup.rs

After installation, restart your terminal and verify:

```bash
rustc --version
cargo --version
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Run Clippy in development

```bash
yarn tauri dev
```

### Build for production

```bash
yarn tauri build
```

## Future Plans

- Better screen understanding
- Increased levels of sarcasm (maybe)

## License

This project is licensed under the [MIT License](LICENSE).

_"It looks like you're making questionable decisions. Would you like help with that?"_
