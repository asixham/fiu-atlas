import Link from 'next/link';
import { Badge } from './ui/badge';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-neutral-950 lg:bg-black px-2 lg:px-3 lg:pt-3">
      <div className="flex h-10 items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          <span className="text-sm font-bold tracking-widest uppercase font-[family-name:var(--font-display)]">FIU ATLAS</span>
          <Badge variant="outline" className="text-xs text-muted-foreground bg-white/10">Beta</Badge>
        </Link>
      </div>
    </header>
  );
}
