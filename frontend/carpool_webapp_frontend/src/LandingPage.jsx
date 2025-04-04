import { useNavigate } from 'react-router-dom';
import Header from './components/Header';

function LandingPage() {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate('/login');
    };

    return (
        <div>
            <Header onLogin={handleLogin} />
        </div>
    );
}

export default LandingPage;
