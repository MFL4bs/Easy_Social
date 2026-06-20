import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users, Eye, ThumbsUp, Share2, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (days = 30) => {
    try {
      const res = await analyticsApi.dashboard(days);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const overview = data?.overview || {};
  const platforms = data?.platforms || {};
  const timeline = data?.timeline || [];

  const statCards = [
    {
      label: 'Total Followers',
      value: overview.totalFollowers?.toLocaleString() || '0',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'Total Impressions',
      value: overview.totalImpressions?.toLocaleString() || '0',
      icon: Eye,
      color: 'bg-green-500',
    },
    {
      label: 'Total Engagement',
      value: overview.totalEngagement?.toLocaleString() || '0',
      icon: ThumbsUp,
      color: 'bg-purple-500',
    },
    {
      label: 'Growth Rate',
      value: `${(overview.followersGrowth || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <select
          onChange={(e) => loadData(parseInt(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          defaultValue="30"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Impressions Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="reach" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform Breakdown */}
      {Object.keys(platforms).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement by Platform</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(platforms)
                  .filter(([_, p]: [string, any]) => !p.error)
                  .map(([name, p]: [string, any]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    likes: p.likes || 0,
                    comments: p.comments || 0,
                    shares: p.shares || 0,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="likes" fill="#3b82f6" />
                <Bar dataKey="comments" fill="#10b981" />
                <Bar dataKey="shares" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Details</h2>
            <div className="space-y-4">
              {Object.entries(platforms).map(([name, p]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{name}</p>
                    <p className="text-sm text-gray-500">@{p.username || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{p.followers?.toLocaleString() || 0} followers</p>
                    <p className="text-xs text-gray-500">{p.engagementRate?.toFixed(1)}% engagement</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!timeline.length && Object.keys(platforms).length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500">Connect your social media accounts to see analytics.</p>
          <a href="/settings" className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block">
            Go to Settings →
          </a>
        </div>
      )}
    </div>
  );
}