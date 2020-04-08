export function toHex(...strings: string[]) {
  let str = strings.join('');
  str = str.replace(/[^0-f]/g, '');

  return Buffer.from(str, 'hex');
}
