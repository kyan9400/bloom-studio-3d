import Header from "@/components/Header";
import Stage from "@/components/Stage";
import ShadePicker from "@/components/ShadePicker";
import Booking from "@/components/Booking";
import MotionToggle from "@/components/MotionToggle";
import { ARTISTS, FAQ, SERVICES } from "@/lib/content";

const CONTACTS = [
  { label: "WhatsApp", href: "https://wa.me/79193999749" },
  { label: "Telegram", href: "https://t.me/hassan_9400" },
  { label: "Email", href: "mailto:kyan775909@gmail.com" },
  { label: "GitHub", href: "https://github.com/kyan9400" },
  { label: "Portfolio", href: "https://alhassan-portfolio-sigma.vercel.app" },
];

const PILLARS = [
  {
    title: "Hospital-grade hygiene",
    copy: "Metal tools go through an autoclave and arrive in a sealed pouch you open yourself.",
  },
  {
    title: "Kind formulas",
    copy: "Our gels are HEMA-free and 10-free. We will tell you exactly what goes on your nails.",
  },
  {
    title: "Time on your side",
    copy: "Appointments are booked with a ten-minute buffer, so we start when we say we will.",
  },
];

const STATS = [
  { value: "4", label: "chairs, never more" },
  { value: "38", label: "lab shades in rotation" },
  { value: "4.9", label: "average from 1,200+ visits" },
];

export default function Home() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />

      <main id="main" tabIndex={-1}>
        {/* ---------------------------------------------------------- Hero / Shade Lab */}
        <section id="lab" className="hero" aria-labelledby="hero-title">
          <span id="top" className="anchor-top" aria-hidden="true" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Nail &amp; beauty studio · Old Flower Market</p>
              <h1 id="hero-title" className="display">
                Colour, mixed <em>for your hands.</em>
              </h1>
              <p className="lead">
                Every appointment at Bloom starts in the Shade Lab. Pick a pigment, choose a finish, watch it catch
                the light — then we lay it down, coat by coat, in a quiet studio that never runs late.
              </p>
              <div className="hero-ctas">
                <a href="#book" className="btn btn-primary">
                  Book this shade
                </a>
                <a href="#menu" className="btn btn-ghost">
                  See the menu
                </a>
              </div>
            </div>

            <div className="hero-stage">
              <Stage />
              <div className="stage-meta">
                <p className="stage-hint">Drag the bottle to turn it.</p>
                <MotionToggle variant="hint" />
              </div>
            </div>

            <div className="hero-picker">
              <ShadePicker />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Menu */}
        <section id="menu" className="section" aria-labelledby="menu-title">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">01 — Services</p>
              <h2 id="menu-title" className="h2">
                The menu
              </h2>
              <p className="section-lead">
                Clear prices, honest timings. Every service includes cuticle care, a hand massage and a shade from the
                lab.
              </p>
            </div>
            <ul className="menu-list">
              {SERVICES.map((s) => (
                <li key={s.id} className="menu-item">
                  <div className="menu-item-head">
                    <h3 className="h3">
                      {s.name}
                      {s.addOn && <span className="tag">Add-on</span>}
                    </h3>
                    <span className="menu-dots" aria-hidden="true" />
                    <p className="menu-price">{s.price}</p>
                  </div>
                  <p className="menu-copy">{s.copy}</p>
                  <p className="menu-duration">{s.duration}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- Studio */}
        <section id="studio" className="section section-dark" aria-labelledby="studio-title">
          <div className="wrap studio-grid">
            <div className="section-head">
              <p className="eyebrow eyebrow-light">02 — The studio</p>
              <h2 id="studio-title" className="h2">
                A slower kind <em>of studio</em>
              </h2>
              <p className="section-lead">
                We kept the flower shop&rsquo;s tiled floor and big windows and built four chairs around them. Nobody is
                rushed and nothing is reused.
              </p>
            </div>
            <ul className="pillars">
              {PILLARS.map((p, i) => (
                <li key={p.title} className="pillar">
                  <span className="pillar-num" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3 className="h3">{p.title}</h3>
                  <p>{p.copy}</p>
                </li>
              ))}
            </ul>
            <dl className="stats">
              {STATS.map((s) => (
                <div key={s.label} className="stat">
                  <dt className="stat-label">{s.label}</dt>
                  <dd className="stat-value">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------------------------------------------------- Artists */}
        <section id="artists" className="section" aria-labelledby="artists-title">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">03 — Artists</p>
              <h2 id="artists-title" className="h2">
                The hands <em>behind it</em>
              </h2>
            </div>
            <ul className="artists">
              {ARTISTS.map((a) => (
                <li key={a.id} className="artist">
                  <div
                    className="artist-tile"
                    aria-hidden="true"
                    style={
                      {
                        "--a1": a.colors[0],
                        "--a2": a.colors[1],
                        "--a3": a.colors[2],
                      } as React.CSSProperties
                    }
                  >
                    <span className="artist-initial">{a.initial}</span>
                    <span className="artist-petal artist-petal-1" />
                    <span className="artist-petal artist-petal-2" />
                    <span className="artist-petal artist-petal-3" />
                  </div>
                  <h3 className="h3">{a.name}</h3>
                  <p className="artist-role">{a.role}</p>
                  <p className="artist-copy">{a.copy}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- Book */}
        <section id="book" className="section section-petal" aria-labelledby="book-title">
          <div className="wrap book-grid">
            <div className="section-head">
              <p className="eyebrow">04 — Booking</p>
              <h2 id="book-title" className="h2">
                Book a chair
              </h2>
              <p className="section-lead">
                Four quick steps. No account, no deposit — we confirm by message within the hour.
              </p>
            </div>
            <Booking />
          </div>
        </section>

        {/* ---------------------------------------------------------- Visit / FAQ */}
        <section id="visit" className="section" aria-labelledby="visit-title">
          <div className="wrap visit-grid">
            <div>
              <p className="eyebrow">05 — Visit</p>
              <h2 id="visit-title" className="h2">
                Visit the studio
              </h2>
              <address className="visit-address">
                14 Old Flower Market
                <br />
                Riverside
              </address>
              <dl className="hours">
                <div>
                  <dt>Tue–Fri</dt>
                  <dd>10:00–20:00</dd>
                </div>
                <div>
                  <dt>Sat</dt>
                  <dd>9:00–18:00</dd>
                </div>
                <div>
                  <dt>Sun–Mon</dt>
                  <dd>Closed</dd>
                </div>
              </dl>
            </div>
            <div className="faq">
              <h3 className="h3 faq-title">Good to know</h3>
              {FAQ.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <p className="footer-brand">
              Bloom <em>Studio</em>
            </p>
            <p className="footer-note">Concept project — fictional brand.</p>
          </div>
          <nav aria-label="Contact">
            <ul className="footer-links">
              {CONTACTS.map((c) => (
                <li key={c.label}>
                  <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="footer-end">
            <MotionToggle />
            <p>© 2026 Alhassan Alfarran</p>
          </div>
        </div>
      </footer>
    </>
  );
}
