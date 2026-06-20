import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { contentApi } from '../services/api';
import { Link } from 'react-router-dom';

const localizer = momentLocalizer(moment);

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      // Load events for a broad range
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const to = new Date();
      to.setFullYear(to.getFullYear() + 1);

      const res = await contentApi.calendar({
        from: from.toISOString(),
        to: to.toISOString(),
      });

      setEvents(
        res.data.items.map((item: any) => ({
          id: item.id,
          title: `${item.title} [${item.status}]`,
          start: new Date(item.start),
          end: new Date(new Date(item.start).getTime() + 60 * 60 * 1000),
          resource: item,
          status: item.status,
        }))
      );
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const eventStyleGetter = (event: any) => {
    const statusColors: Record<string, string> = {
      draft: '#6b7280',
      pending_approval: '#f59e0b',
      approved: '#3b82f6',
      scheduled: '#8b5cf6',
      published: '#10b981',
      failed: '#ef4444',
    };

    return {
      style: {
        backgroundColor: statusColors[event.status] || '#6b7280',
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '0.85rem',
      },
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        <Link
          to="/content/create"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Create Content
        </Link>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 650 }}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
          popup
        />
      </div>

      {events.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>No scheduled content yet.</p>
          <Link to="/content/create" className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block">
            Schedule your first post →
          </Link>
        </div>
      )}
    </div>
  );
}