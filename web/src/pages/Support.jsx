import React from 'react';

const Support = () => {
    return (
        <div className="game-section">
            <div className="support-container">
                <h2 className="section-title">🛠️ SUPPORT CENTER</h2>

                <div className="support-grid">
                    <div className="support-card">
                        <h3>JOIN THE COMMUNITY</h3>
                        <p>Connect with other players, get updates, and find matches.</p>
                        <div className="social-buttons-vertical">
                            <button className="btn-social discord">
                                <span className="icon">💬</span> Join Discord
                            </button>
                            <button className="btn-social twitter">
                                <span className="icon">🐦</span> Follow Twitter
                            </button>
                        </div>
                    </div>

                    <div className="support-card">
                        <h3>SEND FEEDBACK</h3>
                        <p>Found a bug? Have a feature idea? Let us know!</p>
                        <textarea
                            className="feedback-input"
                            placeholder="Describe your issue or idea..."
                            rows={4}
                        />
                        <button className="btn-action primary full-width">SEND MESSAGE</button>
                    </div>

                    <div className="support-card full-width">
                        <h3>FREQUENTLY ASKED QUESTIONS</h3>
                        <div className="faq-list">
                            <div className="faq-item">
                                <strong>How do I withdraw my winnings?</strong>
                                <p>Withdrawals are processed automatically at the end of each tournament. For wager matches, funds are sent directly to your wallet after the match concludes.</p>
                            </div>
                            <div className="faq-item">
                                <strong>What is XP used for?</strong>
                                <p>XP (Experience Points) determines your global rank. Higher ranks will be eligible for exclusive airdrops, NFT mints, and special tournament invites in the future.</p>
                            </div>
                            <div className="faq-item">
                                <strong>Is the game provably fair?</strong>
                                <p>Yes. All game logic is verified on the server, and high scores are recorded on the Abstract blockchain. We are working on a ZK-proof system for fully trustless verification.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
