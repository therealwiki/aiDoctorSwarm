export default function Privacy() {
  return (
    <article className="max-w-2xl flex flex-col gap-3 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-extrabold m-0">Privacy</h1>
      <p>Your questions and records are yours. They are never sold, and never used to train a model.</p>
      <p>Records you connect are verified in three steps: an identity match so nobody can attach someone else’s data to your profile, an attestation from the issuing lab or clinic, and a hash of the verified record anchored on-chain. The data never leaves your vault; only the proof does.</p>
      <p>Care-circle members see only what you grant them: logs, chat, or the ability to act. Agents follow the same rules. You can revoke anyone, including an agent, at any time.</p>
      <p>Email from us is signed (SPF, DKIM, DMARC). We never put a diagnosis in a subject line; health details sit behind a signed link that expires.</p>
      <p>[LEGAL ENTITY], [JURISDICTION]. Contact: privacy@aidoctorswarm.com.</p>
    </article>
  );
}
