# MIDI to key strokes

This is a simple program that listens to a midi device and sends key strokes to the active window.

---

## DISCLAIMER!!!

> Please note that this is not a finished program, just something I hacked together. It works, but I've only tested it on Mac M1, Sonoma 14.1.2.
> I have no idea if it works on other platforms.

---

## Usage

### Prerequisites

- Install [Node.js](https://nodejs.org/en/) (v20 or later)
- [Download this repository](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives#downloading-source-code-archives-from-the-repository-view) or [clone the code](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) to a folder
- Open the folder in a terminal and execute:

  ```sh
  yarn install
  ```

- On Mac, the terminal app needs to be granted _System Settings > Privacy & Security > Accessibility_ permissions. The program will check and help you with this if it's not set. TYhe reason it needs this is to be able to send key strokes,

### Running

Run the program with:

```sh
node index.mjs --config <filename>
```

where `<filename>` is the name of the config file.

### Options

```text
Usage: node index.mjs --config <filename> [options]

Options:
  -c, --config <filename>  The config file to use
  -d, --debug              Enable debug logging, including logging of received midi messages
  -V, --version            output the version number
  -h, --help               display help for command
```

## Config File

See [example_config.jsonc](example_config.jsonc) for an example config file.
