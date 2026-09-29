import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

export default function NotFound() {
  return (
    <Layout>
      <div className="section">
        <div className="card text-center">
          <h1 style={{ fontSize: '2rem' }}>404</h1>
          <p className="muted">Cette page n'existe pas.</p>
          <Link className="btn btn-primary" to="/">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </Layout>
  );
}
