# Flow View & Fixes Architecture Plan

## 1. Fixes
### Selection Style
- **Current:** `bg-[#7c4dff]/10` (Background fill)
- **Target:** `bg-transparent border-2 border-[#7c4dff]` (Outline)
- **Action:** Update `UnifiedTaskItem.tsx` CSS classes conditional on `isSelected`.

### Multi-Select Delete
- **Logic:**
  - Capture `Delete` key globally.
  - Check `selectedTaskIds`.
  - **Day Mode:** Filter out IDs from `tasks` state.
  - **Flow Mode:** Iterate through ALL `logs`, filter out IDs from each log's task list.
  - **Sync:** Save changes to Supabase/LocalStorage.

## 2. New Feature: Flow View (Continuous Scroll)
### State Management
- Add `viewMode`: `'day' | 'flow'` to `App.tsx`.
- Add toggle button in the header area.

### Data Flow
- **Day Mode (Existing):** Uses `tasks` state (single day). Syncs to `logs` on change.
- **Flow Mode (New):**
  - **Read:** Derived from `logs` state.
      - Filter `logs` to exclude empty/invalid entries if needed.
      - Sort by Date.
  - **Write:** Direct manipulation of `logs` array.
      - Helper: `handleLogTaskUpdate(date, taskId, updates)`
      - **Critical Sync:** If the updated task belongs to the `viewDate` (currently active single day), ALSO update the `tasks` state to keep consistency when switching back.

### Rendering Strategy (`FlowView` component or inline)
- Render a list of `DaySection` components.
- **DaySection Structure:**
  - Sticky/Regular Header: `YYYY-MM-DD (Day)`
  - Task List: Map `UnifiedTaskItem`s.
  - **Interaction:**
      - Disable Drag & Drop in Flow Mode initially (complexity reduction).
      - Allow Editing (Text, Checkbox).
      - Allow "Add Task" via a specific `+` button per day section.

### Calendar Integration
- **Day Mode:** Clicking date -> Sets `viewDate`, loads tasks.
- **Flow Mode:** Clicking date -> Scrolls to `#date-section-{date}`.
  - Implementation: `document.getElementById(...).scrollIntoView({ behavior: 'smooth' })`.

## 3. Execution Steps
1. **Refactor:** Extract `DaySection` logic if possible, or build robust inline map in `App.tsx`.
2. **State:** Add `viewMode` and toggle.
3. **Style:** Fix Selection CSS.
4. **Logic:** Implement global Delete handler.
5. **Render:** Implement Flow View rendering loop with scroll anchors.
