export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: March 4, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">Overview</h2>
          <p>Pick The Best Card ("we", "our", or "us") is committed to protecting your privacy. This policy explains what information we collect and how we use it.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Google Sign-In:</strong> When you sign in with Google, we receive your name, email address, and profile picture. We use this solely to identify your account and sync your saved cards across devices.</li>
            <li><strong>Saved Cards:</strong> The credit cards you add to your wallet are stored in our database and associated with your account.</li>
            <li><strong>Usage Data:</strong> We use Vercel Analytics to collect anonymous usage statistics (page views, performance metrics). No personally identifiable information is included.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>To sync your saved cards across devices</li>
            <li>To provide card recommendations based on your wallet</li>
            <li>To improve the app using anonymous analytics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">Data Sharing</h2>
          <p>We do not sell, trade, or share your personal information with third parties. Your data is stored securely and is only used to provide the service.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">Data Deletion</h2>
          <p>You can delete your account and all associated data at any time by contacting us at <a href="mailto:privacy@pickthebestcard.com" className="text-indigo-400 hover:underline">privacy@pickthebestcard.com</a>.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
          <p>If you have any questions about this privacy policy, contact us at <a href="mailto:privacy@pickthebestcard.com" className="text-indigo-400 hover:underline">privacy@pickthebestcard.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
