import React, { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useLoginWithAbstract } from '@abstract-foundation/agw-react';
import { useNavigate, useLocation } from 'react-router-dom';
import FAQModal from './FAQModal';

const TopBar = () => {
    const { address, isConnected } = useAccount();
    const { login, logout } = useLoginWithAbstract();
    const { data: balanceData } = useBalance({ address });
    const [copied, setCopied] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isFAQOpen, setIsFAQOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <>
            <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />

            <header className="top-bar">
                <div className="top-left">
                    <div className="dropdown-container" style={{ position: 'relative' }}>
                        <span
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{
                                cursor: 'pointer',
                                color: location.pathname === '/support' || isDropdownOpen ? '#ccff00' : 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span className="icon" style={{ fontSize: '1.2rem' }}>🛟</span> Support <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{isDropdownOpen ? '▲' : '▼'}</span>
                        </span>

                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                <div className="dropdown-item" onClick={() => { setIsFAQOpen(true); setIsDropdownOpen(false); }}>
                                    FAQ
                                </div>
                                <div className="dropdown-item" onClick={() => { window.open('https://docs.abs.xyz', '_blank'); setIsDropdownOpen(false); }}>
                                    Docs
                                </div>
                                <div className="dropdown-item" onClick={() => { navigate('/support'); setIsDropdownOpen(false); }}>
                                    Support
                                </div>
                            </div>
                        )}
                    </div>
                    <span>Referrals</span>
                </div>
                <div className="top-right">
                    {!isConnected ? (
                        <button onClick={login} className="btn-login-small">
                            <span className="icon">⚡</span> Sign in
                        </button>
                    ) : (
                        <div className="wallet-display">
                            <span className="balance">{balanceData ? parseFloat(balanceData.formatted).toFixed(4) : '0.00'} ETH</span>
                            <div className="address-pill" onClick={copyAddress}>
                                {copied ? 'COPIED' : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                            </div>
                            <button onClick={logout} className="btn-logout">×</button>
                        </div>
                    )}
                </div>
            </header>
        </>
    );
};

export default TopBar;
