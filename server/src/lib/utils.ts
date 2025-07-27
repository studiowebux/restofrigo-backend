export function millisToHuman(millis: number) {
  const parsedMillis = Math.abs(millis);

  const days: number = Math.floor(parsedMillis / (24 * 60 * 60 * 1000));
  const hours: number = Math.floor((parsedMillis / (60 * 60 * 1000)) % 24);
  const minutes: number = Math.floor((parsedMillis / 60000) % 60);
  const seconds: number = Math.floor((parsedMillis % 60000) / 1000);

  const result: (string | number)[] = [];

  if (days > 0) {
    result.push(`${days}d`);
  }

  if (hours > 0) {
    result.push(`${hours}h`);
  }

  if (minutes > 0) {
    result.push(`${minutes}m`);
  }

  if (seconds > 0) {
    result.push(`${seconds}s`);
  }

  if (!days && !hours && !minutes && !seconds) {
    result.push(`${parsedMillis}ms`);
  }

  return result.join(" ");
}
