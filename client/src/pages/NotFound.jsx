import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-7xl font-bold font-display text-accent/20 mb-4">
          404
        </h1>
        <p className="text-lg text-text-primary font-medium mb-2">
          Page not found
        </p>
        <p className="text-sm text-text-secondary mb-6">
          The page you're looking for doesn't exist
        </p>
        <Button onClick={() => navigate('/')}>
          Go Home
        </Button>
      </motion.div>
    </div>
  );
}
