export function toHex(...strings: string[]) {
  let str = strings.join('');
  str = str.replace(/[^0-9a-f]/gi, '');

  return Buffer.from(str, 'hex');
}
