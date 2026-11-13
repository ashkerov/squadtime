import s from './Avatar.module.css';

/** Цвет кружка стабильно вычисляется из имени. */
function avatarHue(name: string): number {
  let h = 0;
  for (const ch of name.toLocaleLowerCase('ru')) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('').toLocaleUpperCase('ru');
  return ([...parts[0]][0] + [...parts[1]][0]).toLocaleUpperCase('ru');
}

export function Avatar({
  name,
  size = 32,
  ring,
  title,
}: {
  name: string;
  size?: number;
  ring?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`${s.avatar} ${ring ? s.ring : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        ['--hue' as string]: avatarHue(name),
      }}
      title={title ?? name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 6,
  size = 28,
}: {
  names: string[];
  max?: number;
  size?: number;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className={s.stack} aria-label={names.join(', ')} role="img">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} ring />
      ))}
      {rest > 0 && (
        <span className={`${s.avatar} ${s.ring} ${s.more}`} style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
