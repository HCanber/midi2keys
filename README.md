# MIDI to key strokes

This is a simple program that listens to a midi device and sends key strokes to the active window.

---

## DISCLAIMER!!!

> Please note that this is not a finished program, just something I hacked together. It works, but I've only tested it on Mac M1, Sonoma 14.1.2.
> I have no idea if it works on other platforms.
> Things might change and config files may not be compatible between versions.

---

## Usage

### Prerequisites

- Install [Node.js](https://nodejs.org/en/) (v20 or later)
- On Mac, the terminal app needs to be granted _System Settings > Privacy & Security > Accessibility_ permissions. The program will check and help you with this if it's not set. The reason it needs this is to be able to send key strokes.

### Two ways to run

Either you install it globally or you run it using npx.

#### Install globally

Run the following command in a terminal to install it globally:

```sh
npm install -g github:hcanber/midi2keys
```

After this you can use `midi2keys` as a command.

#### Run using npx

You can also run it using npx, which means that you don't have to install it globally. The downside is that it will be slower to start .

In the instructions below, replace `midi2keys` with `npx github:hcanber/midi2keys`.

### First time setup

Create a config file (see below). You can start by create a config based on [example_config.jsonc](example_config.jsonc) and edit it.

```sh
midi2keys create-config
```

or

```sh
npx github:hcanber/midi2keys create-config
```

### Running

Run the program with:

```sh
midi2keys
```

```sh
midi2keys monitor
```

### Options

```text
Usage: midi2Keys [options] [--config <filename>]

Perform actions based on received midi messages as defined in config file.
Specify "help" to see full help

Options:
  -c, --config <filename>  The config file to use. If not specified, will use midikeys_config.jsonc.
  -d, --debug              Enable debug logging, including logging of received midi messages
  -i, --input <name>       The name of the midi input to use. Use list-inputs to list available
                           inputs. Will override preferredInput in config file.
  -m, --monitor            Enable logging of received midi messages
  -h, --help               Displays this help
```

```text
Usage: midi2Keys [command]
Commands:
  create-config [filename]  Creates a config file based on example config. Use this as a starting point
  list-inputs               List available midi inputs
  monitor [options]         Logs received midi messages
  help [command]            display help for command
```

## Config File

See [example_config.jsonc](example_config.jsonc) for an example config file.
The format is JSONC, which means that it's JSON that allows comments.

## Local development

- [Clone the code](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) to a folder
- Install dependencies: Open the folder in a terminal and execute:

  ```sh
  yarn install
  ```
