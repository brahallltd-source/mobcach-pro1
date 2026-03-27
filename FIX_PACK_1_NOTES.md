
# V17.1 FIX PACK 1

This pack fixes the first blocking admin/agent application issues:

- apply-agent now writes directly to Prisma
- admin agent applications now read directly from Prisma
- approve / reject now use Prisma-first logic
- admin agents page status mapping is fixed:
  - pending_agent_review -> pending
  - account_created -> approved
