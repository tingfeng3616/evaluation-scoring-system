import { Navigate, createBrowserRouter } from 'react-router-dom'

import App from './App'
import { AdminPage } from './pages/AdminPage'
import { DisplayPage } from './pages/DisplayPage'
import { NoticePage } from './pages/NoticePage'
import { RankingPage } from './pages/RankingPage'
import { ScorePage } from './pages/ScorePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/score" replace /> },
      { path: 'score', element: <ScorePage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'display', element: <DisplayPage /> },
      { path: 'notice', element: <NoticePage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
])
