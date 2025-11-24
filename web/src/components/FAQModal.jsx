import React, { useState } from 'react';

const FAQModal = ({ isOpen, onClose }) => {
    const [expandedSection, setExpandedSection] = useState(null);

    if (!isOpen) return null;

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content faq-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                <h2 className="modal-title">How to Play</h2>

                <div className="faq-content">
                    <div className="faq-steps">
                        <div className="faq-step">
                            <span className="step-number">1.</span>
                            <span className="step-text">Use arrow keys to control your snake</span>
                        </div>
                        <div className="faq-step">
                            <span className="step-number">2.</span>
                            <span className="step-text">Collect red food to grow and earn points</span>
                        </div>
                        <div className="faq-step">
                            <span className="step-number">3.</span>
                            <span className="step-text">Avoid hitting walls or yourself</span>
                        </div>
                        <div className="faq-step">
                            <span className="step-number">4.</span>
                            <span className="step-text">Your score is automatically submitted to blockchain</span>
                        </div>
                        <div className="faq-step">
                            <span className="step-number">5.</span>
                            <span className="step-text">Compete for top spot on the leaderboard</span>
                        </div>
                        <div className="faq-step">
                            <span className="step-number">6.</span>
                            <span className="step-text">Enable auto-submit for gasless transactions</span>
                        </div>
                    </div>

                    <div className="faq-sections">
                        <div className="faq-section">
                            <div className="faq-section-header" onClick={() => toggleSection('fair')}>
                                <span>Provably Fair</span>
                                <span className="faq-chevron">{expandedSection === 'fair' ? '▲' : '▼'}</span>
                            </div>
                            {expandedSection === 'fair' && (
                                <div className="faq-section-content">
                                    <p>All game logic is verified on-chain. High scores are recorded on the Abstract blockchain ensuring transparency and fairness. We're working on a ZK-proof system for fully trustless verification.</p>
                                </div>
                            )}
                        </div>

                        <div className="faq-section">
                            <div className="faq-section-header" onClick={() => toggleSection('referral')}>
                                <span>Referral Program</span>
                                <span className="faq-chevron">{expandedSection === 'referral' ? '▲' : '▼'}</span>
                            </div>
                            {expandedSection === 'referral' && (
                                <div className="faq-section-content">
                                    <p>Earn rewards by referring friends! Share your referral link and get 10% of your referrals' wager fees. Plus, your friends get a bonus on their first game.</p>
                                </div>
                            )}
                        </div>

                        <div className="faq-section">
                            <div className="faq-section-header" onClick={() => toggleSection('multiplier')}>
                                <span>Multiplier Calculation</span>
                                <span className="faq-chevron">{expandedSection === 'multiplier' ? '▲' : '▼'}</span>
                            </div>
                            {expandedSection === 'multiplier' && (
                                <div className="faq-section-content">
                                    <p>Each food collected = +10 points. Score multiplier increases with consecutive achievements. Compete in tournaments for bonus multipliers and exclusive rewards.</p>
                                </div>
                            )}
                        </div>

                        <div className="faq-section">
                            <div className="faq-section-header" onClick={() => toggleSection('support')}>
                                <span>Support</span>
                                <span className="faq-chevron">{expandedSection === 'support' ? '▲' : '▼'}</span>
                            </div>
                            {expandedSection === 'support' && (
                                <div className="faq-section-content">
                                    <p>Need help? Join our Discord community or check out our documentation. For urgent issues, contact us through the support page.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FAQModal;
