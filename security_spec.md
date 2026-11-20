# Firestore Security Specification (Mahmoud Chess)

## 1. Data Invariants
1. Unauthenticated or unverified users (`request.auth == null` or `email_verified != true`) cannot read or write `/invites/{inviteCode}` or `/matches/{matchId}`.
2. An `InviteRecord` at `/invites/{inviteCode}` can only be created with `ownerUid == request.auth.uid`, valid code matching `inviteCode` (`^[A-Z0-9]{4,12}$`), valid server timestamps (`createdAt == request.time`, `updatedAt == request.time`), and strict key allowlisting.
3. Updates to `/invites/{inviteCode}` are restricted to the `ownerUid`, cannot occur once `status == 'finished'` (terminal state lock), keep `code`, `ownerUid`, and `createdAt` immutable, and may only update `['status', 'updatedAt']` with `updatedAt == request.time`.
4. `allow list` on `/invites` and `/matches` strictly enforces `resource.data.ownerUid == request.auth.uid` so no user can scrape another user's private matches or invite lists.
5. `MatchRecord` documents at `/matches/{matchId}` are immutable historical archives: only `ownerUid` can create/read/delete their own archived matches, updates are forbidden, and `moves` is strictly bounded (`<= 350`).

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating an invite or match when `request.auth == null`.
2. **Unverified Email**: Creating an invite when `request.auth.token.email_verified == false`.
3. **UID Spoofing**: Creating a match with `ownerUid: "other-user-uid"`.
4. **Shadow / Ghost Field Injection**: Adding `isAdmin: true` or `extraField: "hack"` to an `InviteRecord` or `MatchRecord`.
5. **Client Timestamp Forgery**: Setting `createdAt` to a past/future timestamp instead of `request.time`.
6. **ID Poisoning**: Creating `/invites/invalid$$$code_too_long...` violating `^[A-Z0-9]{4,12}$`.
7. **Path/Payload Code Mismatch**: Creating `/invites/ABC123` with `code: "XYZ999"`.
8. **Terminal State Bypass**: Updating an invite whose `existing().status == 'finished'`.
9. **Unauthorized Status Update**: Updating another user's invite `status` or mutating `hostName` / `ownerUid`.
10. **Blanket List Scraping**: Listing `/matches` or `/invites` without filtering by `ownerUid == request.auth.uid`.
11. **Oversized Array / String Exhaustion**: Creating a `MatchRecord` with `moves.size() > 350` or `resultText` > 120 chars.
12. **Archive Tampering**: Attempting to `update` a completed `MatchRecord` to falsify `winner` or `moves`.
