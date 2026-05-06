import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.insightd.org',
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
            { label: 'Kubernetes / k3s', slug: 'guides/kubernetes' },
            { label: 'Proxmox VE', slug: 'guides/proxmox' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment Variables', slug: 'reference/config' },
            { label: 'Keyboard Shortcuts', slug: 'reference/keyboard-shortcuts' },
            { label: 'Webhooks', slug: 'reference/webhooks' },
            { label: 'Endpoint Monitoring', slug: 'reference/endpoints' },
          ],
        },
        {
          label: 'Insights Engine',
          items: [
            { label: 'Health Check Diagnosis', slug: 'insights/diagnosis' },
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
