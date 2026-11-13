import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { Final } from './pages/Final';
import { Home } from './pages/Home';
import { Mark } from './pages/Mark';
import { MeetingLayout } from './pages/MeetingLayout';
import { useMeetingContext } from './pages/meetingContext';
import { NewMeeting } from './pages/NewMeeting';
import { NotFound } from './pages/NotFound';
import { Places } from './pages/Places';
import { Results } from './pages/Results';

function Root() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

function EditMeeting() {
  const { meeting } = useMeetingContext();
  return <NewMeeting meeting={meeting} />;
}

/** Маршруты сразу такие, какими они будут на настоящем сайте. */
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/new', element: <NewMeeting /> },
      {
        path: '/m/:id',
        element: <MeetingLayout />,
        children: [
          { index: true, element: <Mark /> },
          { path: 'results', element: <Results /> },
          { path: 'places', element: <Places /> },
          { path: 'final', element: <Final /> },
          { path: 'edit', element: <EditMeeting /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
