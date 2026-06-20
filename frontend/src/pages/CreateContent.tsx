import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentApi } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Upload, X, Image, Film } from 'lucide-react';

const platforms = ['facebook', 'instagram', 'twitter', 'tiktok'];

export default function CreateContent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'carousel'>('image');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      loadContent();
    }
  }, [id]);

  const loadContent = async () => {
    try {
      const res = await contentApi.list({ page: '1', limit: '1' });
      const item = res.data.items.find((i: any) => i.id === id);
      if (item) {
        setCaption(item.caption || '');
        setBody(item.body || '');
        setHashtags(item.hashtags?.join(', ') || '');
        setMediaUrls(item.mediaUrls || []);
        setMediaType(item.mediaType || 'image');
        setLinkUrl(item.linkUrl || '');
        setScheduledAt(item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '');
        setTargetPlatforms(item.targetPlatforms || []);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      const res = await api.post('/upload', formData);
      setMediaUrls((prev) => [...prev, ...res.data.urls]);
      // Auto-detect media type
      const hasVideo = Array.from(files).some((f) => f.type.startsWith('video/'));
      if (hasVideo) setMediaType('video');
      else if (mediaUrls.length + res.data.urls.length > 1) setMediaType('carousel');
      toast.success('Files uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeMedia = (url: string) => {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  };

  const togglePlatform = (platform: string) => {
    setTargetPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        caption,
        body,
        hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
        mediaUrls,
        mediaType,
        linkUrl,
        scheduledAt: scheduledAt || null,
        targetPlatforms,
      };

      if (isEdit) {
        await contentApi.update(id!, data);
        toast.success('Content updated');
      } else {
        await contentApi.create(data);
        toast.success('Content created');
      }
      navigate('/content');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Content' : 'Create Content'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-5">
        {/* Caption */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Caption *</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Your post caption"
            required
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">{caption.length}/500</p>
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="Longer description or article text"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags</label>
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="social, media, marketing (comma separated)"
          />
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Media</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {uploading ? 'Uploading...' : 'Click to upload images or videos'}
            </p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF, WEBP, MP4, MOV up to 50MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {mediaUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {mediaUrls.map((url) => (
                <div key={url} className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square">
                  {url.match(/\.(mp4|mov|avi)$/i) ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-8 h-8 text-gray-400" />
                    </div>
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(url)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Media Type</label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as any)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="carousel">Carousel (Multiple Images)</option>
          </select>
        </div>

        {/* Link URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="https://example.com/article"
          />
        </div>

        {/* Target Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Platforms</label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  targetPlatforms.includes(platform)
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Leave empty to save as draft</p>
        </div>

        {/* Submit */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            type="submit"
            disabled={loading || !caption || targetPlatforms.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Content' : 'Create Content'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/content')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}