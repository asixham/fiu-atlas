import Link from 'next/link';
import { Badge } from './ui/badge';

export function Header() {
  return (
    <header className="sticky top-0">
      <div className="flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          <span className="text-3xl font-bold tracking-tighter text-zinc-300 font-[family-name:var(--font-display)]">fiU AtlAs</span>
          <Badge variant="outline" className="text-xs text-muted-foreground bg-white/10">Beta</Badge>
        </Link>
      </div>
    </header>
  );
}
