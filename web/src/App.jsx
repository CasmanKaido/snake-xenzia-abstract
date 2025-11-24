import { AbstractWalletProvider } from '@abstract-foundation/agw-react';
import { abstractTestnet } from 'viem/chains';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import Home from './pages/Home';
import Support from './pages/Support';
import Multiplayer from './pages/Multiplayer';
import Tournament from './pages/Tournament';

export default function App() {
    return (
        <AbstractWalletProvider chain={abstractTestnet}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="multiplayer" element={<Multiplayer />} />
                        <Route path="tournament" element={<Tournament />} />
                        <Route path="support" element={<Support />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AbstractWalletProvider>
    );
}
