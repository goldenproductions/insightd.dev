import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  base: '/insightd.dev/',
  integrations: [
    starlight({
      title: 'insightd',
      description: 'Self-hosted server awareness for homelabbers',
      social: {
        github: 'https://github.com/goldenproductions/insightd',
      },
      sidebar: [
        { label: 'Home', link: '/' },
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'guides/introduction' },
            { label: 'Quick Start', slug: 'guides/quick-start' },
            { label: 'Docker Compose', slug: 'guides/docker-compose' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment Variables', slug: 'reference/config' },
            { label: 'Webhooks', slug: 'reference/webhooks' },
            { label: 'Endpoint Monitoring', slug: 'reference/endpoints' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'REST API', slug: 'reference/api' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
