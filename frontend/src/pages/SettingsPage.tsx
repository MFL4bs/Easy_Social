import React, { useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const platformInfo: Record<string, { name: string; color: string; icon: string }> = {
  facebook: { name: 'Facebook', color: 'bg-blue-600', icon: 'f' },
  instagram: { name: 'Instagram', color: 'bg-pink-600', icon: 'ig' },
  twitter: { name: 'Twitter / X', color: 'bg-black', icon: 'X' },
  tiktok: { name: 'TikTok', color: 'bg-gray-900', icon: 'tk' },
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await authApi.me();
      setAccounts(res.data.connectedAccounts || []);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await authApi.connectUrl(platform);
      // Open OAuth popup
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to connect ${platform}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform} account?`)) return;
    try {
      await authApi.disconnect(platform);
      toast.success(`${platform} disconnected`);
      loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  // Check for OAuth callback result in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get('platform');
    const error = params.get('error');

    if (platform && params.get('connected') === 'true') {
      toast.success(`${platform} connected successfully!`);
      loadAccounts();
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      toast.error('Failed to connect account');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Connected Accounts */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h2>
        <p className="text-sm text-gray-500 mb-6">
          Connect your social media accounts to start managing content and viewing analytics.
        </p>

        <div className="space-y-3">
          {Object.entries(platformInfo).map(([platform, info]) => {
            const account = accounts.find((a) => a.platform === platform && a.isActive);

            return (
              <div
                key={platform}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`${info.color} w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {info.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{info.name}</p>
                    {account ? (
                      <p className="text-sm text-gray-500">
                        @{account.platformUsername || account.platformDisplayName || 'Connected'}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Not connected</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {account ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <button
                        onClick={() => handleDisconnect(platform)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform)}
                      disabled={connecting === platform}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {connecting === platform ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Extending Platforms</h2>
        <p className="text-sm text-gray-500">
          Easy Social is built with an extensible adapter pattern. To add a new platform,
          implement the <code className="bg-gray-100 px-1 rounded">PlatformAdapter</code> interface
          and register it in the platform registry.
        </p>
      </div>
    </div>
  );
}