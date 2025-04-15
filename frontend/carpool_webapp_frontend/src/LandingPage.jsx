import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import HeroSection from './components/HeroSection';

function LandingPage() {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate('/login');
    };

    return (
        <div>
            <Header onLogin={handleLogin} />
            <HeroSection />
        </div>
    );
}

export default LandingPage;
