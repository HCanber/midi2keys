// Matches modifiers: https://robotjs.io/docs/syntax#keytapkey-modifier
export const validKeyModifiers = new Set(['alt', 'shift', 'command', 'ctrl'])

// Matches: https://robotjs.io/docs/syntax#keys
export const validKeys = new Set([
  'backspace',
  'delete',
  'enter',
  'tab',
  'escape',
  'up',
  'down',
  'right',
  'left',
  'home',
  'end',
  'pageup',
  'pagedown',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'command',
  'alt',
  'control',
  'shift',
  'right_shift',
  'space',
  'printscreen', // No Mac support
  'insert', // No Mac support
  'audio_mute',
  'audio_vol_down',
  'audio_vol_up',
  'audio_play',
  'audio_stop',
  'audio_pause',
  'audio_prev',
  'audio_next',
  'audio_rewind', // Linux only
  'audio_forward', // Linux only
  'audio_repeat', // Linux only
  'audio_random', // Linux only
  'numpad_0', // No Linux support
  'numpad_1', // No Linux support
  'numpad_2', // No Linux support
  'numpad_3', // No Linux support
  'numpad_4', // No Linux support
  'numpad_5', // No Linux support
  'numpad_6', // No Linux support
  'numpad_7', // No Linux support
  'numpad_8', // No Linux support
  'numpad_9', // No Linux support
  'lights_mon_up', // Turn up monitor brightness, No Windows support
  'lights_mon_down', // Turn down monitor brightness, No Windows support
  'lights_kbd_toggle', // Toggle keyboard backlight on/off, No Windows support
  'lights_kbd_up', // Turn up keyboard backlight brightness, No Windows support
  'lights_kbd_down', // Turn down keyboard backlight brightness, No Windows support
])
