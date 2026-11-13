import { useState } from 'react';
import s from './Confetti.module.css';

const COLORS = ['var(--accent)', '#ffb703', '#fb5607', '#3a86ff', '#06d6a0', '#ff006e'];

/** Конфетти при фиксации встречи. При prefers-reduced-motion анимации нет. */
export function Confetti({ count = 60 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.4 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 1080,
      color: COLORS[i % COLORS.length],
      round: Math.random() < 0.3,
    })),
  );
  return (
    <div className={s.root} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`${s.piece} ${p.round ? s.round : ''}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
