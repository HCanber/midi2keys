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

- Create a config file (see below). You can start by copying [example_config.jsonc](example_config.jsonc) and edit it.

  - Mac:

    ```sh
    cp example_config.jsonc config.jsonc
    ```

  - Windows:

    ```sh
    copy example_config.jsonc config.jsonc
    ```

### Running

Run the program with:

```sh
node index.mjs --config <filename>
```

where `<filename>` is the name of the config file.

If you only want to use the program as a MIDI monitor, you can run it with:

```sh
node index.mjs --monitor
```

### Options

```text
Usage: node index.mjs --config <filename> [options]

Options:
  -c, --config <filename>  The config file to use
  -i, --input <name>       The name of the midi input to use. Use --list-inputs
                           to list available inputs. Will override preferredInput
                           in config file.
      --list-inputs        List available midi inputs
  -m, --monitor            Enable logging of received midi messages
  -c, --config <filename>  The config file to use
  -d, --debug              Enable debug logging, including logging of received
                           midi messages
  -v, --version            Outputs the version number
  -h, --help               Display this help
```

## Config File

See [example_config.jsonc](example_config.jsonc) for an example config file.
The format is JSONC, which means that it's JSON that allows comments.
