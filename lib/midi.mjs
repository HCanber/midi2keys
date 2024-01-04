import midiPkg from 'midi'

const { Input } = midiPkg

export function getInputAndMidiPorts() {
  // Set up a new midi input.
  const input = new Input()

  const numberOfPorts = input.getPortCount()
  const ports = []
  for (let i = 0; i < numberOfPorts; i++) {
    const portName = input.getPortName(i)
    ports.push({ name: portName, index: i })
  }
  return { input, midiPorts: ports }
}
