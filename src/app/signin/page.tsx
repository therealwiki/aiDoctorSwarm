export default function SignIn() {
  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold m-0">Sign in</h1>
      <p className="m-0 text-ink-soft text-sm">We’ll email you a one-time link from hello@aidoctorswarm.com. No password to remember.</p>
      <form className="card p-5 flex flex-col gap-3" action="/api/auth/magic" method="post">
        <label htmlFor="email" className="text-sm font-bold">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@email.com" className="border border-line rounded-xl px-3 py-2 bg-transparent" />
        <button className="btn-sun" type="submit">Send me a link</button>
      </form>
      <p className="text-xs text-ink-soft m-0">Not live yet — needs a sending provider (see README).</p>
    </div>
  );
}
