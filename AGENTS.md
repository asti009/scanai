<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the existing TanStack Start routes, Cloud Auth, and generated Supabase client for application functions and persisted data; do not replace the project with the brief's separate Express/Prisma stack, so deployment remains compatible with the configured Lovable runtime.
- Keep agency-scoped browser data actions on the generated client under row-level access rules, and resolve public tracked QR links through the saved scan function so destinations and analytics share one source of truth.
