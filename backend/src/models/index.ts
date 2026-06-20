import { User } from './User';
import { ConnectedAccount } from './ConnectedAccount';
import { ContentItem } from './ContentItem';
import { PostRecord } from './PostRecord';
import { AnalyticsRecord } from './AnalyticsRecord';

export const entities = [
  User,
  ConnectedAccount,
  ContentItem,
  PostRecord,
  AnalyticsRecord,
];

export {
  User,
  ConnectedAccount,
  ContentItem,
  PostRecord,
  AnalyticsRecord,
};

export type {
  UserRole,
} from './User';

export type {
  PlatformType,
} from './ConnectedAccount';

export type {
  ContentStatus,
  MediaType,
} from './ContentItem';

export type {
  PostStatus,
} from './PostRecord';

export type {
  MetricType,
} from './AnalyticsRecord';