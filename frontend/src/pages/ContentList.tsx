import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '../services/api';
import { Plus, Edit2, Trash2, CheckCircle, Send, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function ContentList() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [page, status]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '20' };
      if (status) params.status = status;
      const res = await contentApi.list(params);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await contentApi.approve(id);
      toast.success('Content approved');
      loadContent();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      await contentApi.publishNow(id);
      toast.success('Content queued for publishing');
      loadContent();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to publish');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content?')) return;
    try {
      await contentApi.delete(id);
      toast.success('Content deleted');
      loadContent();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Content</h1>
        <Link
          to="/content/create"
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Content</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['', 'draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === s
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500">No content yet.</p>
          <Link to="/content/create" className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block">
            Create your first post →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    {item.targetPlatforms?.map((p: string) => (
                      <span key={p} className="text-xs text-gray-500 capitalize">{p}</span>
                    ))}
                  </div>
                  <p className="text-gray-900 font-medium truncate">{item.caption}</p>
                  {item.scheduledAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(item.scheduledAt).toLocaleString()}
                    </p>
                  )}
                  {item.postRecords?.map((r: any) => (
                    r.status === 'failed' && (
                      <p className="text-sm text-red-600 mt-1" key={r.id}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {r.platform}: {r.errorMessage}
                      </p>
                    )
                  ))}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {item.status === 'pending_approval' && (
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Approve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {(item.status === 'approved' || item.status === 'scheduled') && (
                    <button
                      onClick={() => handlePublishNow(item.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Publish Now"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  {item.status !== 'published' && (
                    <Link
                      to={`/content/${item.id}/edit`}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-center space-x-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}