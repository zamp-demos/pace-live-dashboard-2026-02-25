import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProcessList from './components/ProcessList';
import ProcessDetails from './components/ProcessDetails';
import KnowledgeBase from './components/KnowledgeBase';
import ChatPanel from './components/ChatPanel';
import Login from './components/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="processes" replace />} />
          <Route path="processes" element={<ProcessList />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="process/:runId" element={<ProcessDetails />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatPanel />
    </BrowserRouter>
  );
}

export default App;
