import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProcessList from './components/ProcessList';
import ProcessDetails from './components/ProcessDetails';
import KnowledgeBase from './components/KnowledgeBase';
import ChatPanel from './components/ChatPanel';
import Login from './components/Login';
import DataExplorer from './components/DataExplorer';
import InsightsPanel from './components/InsightsPanel';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="processes" replace />} />
          <Route path="processes" element={<ProcessList />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="process/:runId" element={<ErrorBoundary><ProcessDetails /></ErrorBoundary>} />
          <Route path="data" element={<DataExplorer />} />
          <Route path="insights" element={<InsightsPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatPanel />
    </BrowserRouter>
  );
}

export default App;
