import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-mono text-xs">
      <h2 className="text-sm font-semibold mb-2">404 - Page Not Found</h2>
      <Link href="/" className="text-zinc-400 hover:text-white underline">
        Return to Dashboard
      </Link>
    </div>
  );
}
