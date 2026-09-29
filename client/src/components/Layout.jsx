import { Link } from 'react-router-dom';
import logo from '../assets/image.png';

export default function Layout({ children }) {
  const year = new Date().getFullYear();
  return (
    <div className="page">
      <header className="site-header">
        <div className="container">
          <Link className="brand" to="/">
            <img className="brand-logo" src={logo} alt="EXPHA" />
          </Link>
          <div className="header-meta">
            <span className="hide-sm">17 octobre 2026 — Hôtel Africa Queen – Somone</span>
            <Link className="header-link" to="/admin">
              Espace admin
            </Link>
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <span>
            © {year} EXPHA — Journée de formation et de détente
          </span>
          <span className="credit">Made by Mounir DIGITAL</span>
        </div>
      </footer>
    </div>
  );
}
