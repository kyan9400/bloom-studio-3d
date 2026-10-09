import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main id="main" className="notfound">
      <div>
        <div className="notfound-swatch" aria-hidden="true" />
        <p className="eyebrow">Error 404</p>
        <h1 className="h2">This shade isn&rsquo;t in the lab.</h1>
        <p className="section-lead" style={{ maxWidth: "28em", margin: "0 auto 32px" }}>
          The page you were looking for has been wiped off. Head back to the studio and pick another colour.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Bloom Studio
        </Link>
      </div>
    </main>
  );
}
