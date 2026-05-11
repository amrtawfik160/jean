/**
 * Centralized icon registry — Hugeicons under lucide-compatible names.
 *
 * The codebase historically imported icons from `lucide-react`. This module
 * re-exports the same names as Hugeicons-backed components so the rest of the
 * app keeps using `<Plus className="size-4" />` style JSX without rewriting
 * call sites. The mapping is curated for visual parity with lucide.
 *
 * Default size is 16 to match Tailwind's `size-4`. `className` always wins —
 * Tailwind `size-*` utilities override the SVG width/height attributes.
 */
import { forwardRef } from 'react'
import {
  HugeiconsIcon,
  type HugeiconsProps,
  type IconSvgElement,
} from '@hugeicons/react'
import {
  Activity01Icon,
  Add01Icon,
  AlertCircleIcon,
  AlertDiamondIcon,
  ArchiveIcon,
  Archive02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDownDoubleIcon,
  AttachmentIcon,
  BarChartIcon,
  BellDotIcon,
  Bookmark01Icon,
  BookmarkAdd01Icon,
  BotIcon,
  BrainIcon,
  Briefcase01Icon,
  BugIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CancelSquareIcon,
  Chat01Icon,
  CheckmarkCircle01Icon,
  CheckListIcon,
  ClipboardIcon,
  Clock01Icon,
  CodeIcon,
  CommandIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  Delete01Icon,
  Download01Icon,
  Edit01Icon,
  Edit02Icon,
  EyeIcon,
  FileEditIcon,
  FileEmptyIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderEditIcon,
  FolderLibraryIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitForkIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  Github01Icon,
  GlobeIcon,
  HelpCircleIcon,
  Home01Icon,
  IdeaIcon,
  ImageIcon as HugeImageIcon,
  InformationCircleIcon,
  KeyboardIcon,
  Layers01Icon,
  Link02Icon,
  ListSettingIcon,
  Loading03Icon,
  Login03Icon,
  MagicWand01Icon,
  Maximize02Icon,
  Menu02Icon,
  MessageEditIcon,
  Minimize02Icon,
  MinusSignCircleIcon,
  MinusSignIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PaintBoardIcon,
  PauseIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  PlayIcon,
  Plug01Icon,
  PuzzleIcon,
  Refresh01Icon,
  RestoreBinIcon,
  RotateLeft01Icon,
  RotateRight01Icon,
  Search01Icon,
  Sent02Icon,
  Settings02Icon,
  Shield01Icon,
  SidebarBottomIcon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  SparklesIcon,
  Square01Icon,
  StarIcon,
  Tag01Icon,
  Target01Icon,
  Task01Icon,
  TerminalIcon,
  TestTubeIcon,
  ThumbsUpIcon,
  Tick02Icon,
  Undo02Icon,
  Upload01Icon,
  UserMultipleIcon,
  ViewOffIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'

// Type aliases for consumers that imported lucide types.
// Loosen strokeWidth to accept string|number to match lucide's API.
export type LucideProps = Omit<HugeiconsProps, 'icon' | 'strokeWidth'> & {
  strokeWidth?: number | string
}
export type LucideIcon = React.ForwardRefExoticComponent<
  LucideProps & React.RefAttributes<SVGSVGElement>
>

const make = (icon: IconSvgElement): LucideIcon =>
  forwardRef<SVGSVGElement, LucideProps>(function HugeiconWrapper(
    { strokeWidth, ...props },
    ref
  ) {
    const sw =
      typeof strokeWidth === 'string' ? Number(strokeWidth) : strokeWidth
    return (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        size={16}
        strokeWidth={Number.isFinite(sw) ? (sw as number) : 1.5}
        {...props}
      />
    )
  })

// — Status / state —
export const Activity = make(Activity01Icon)
export const AlertCircle = make(AlertCircleIcon)
export const AlertTriangle = make(AlertDiamondIcon)
export const Bug = make(BugIcon)
export const Check = make(Tick02Icon)
export const CheckIcon = Check
export const CheckCircle = make(CheckmarkCircle01Icon)
export const CheckCircle2 = make(CheckmarkCircle01Icon)
export const Circle = make(Square01Icon)
export const CircleIcon = make(CheckmarkCircle01Icon)
export const CircleDot = make(CheckmarkCircle01Icon)
export const CircleHelp = make(HelpCircleIcon)
export const CirclePause = make(PauseIcon)
export const Info = make(InformationCircleIcon)
export const HelpCircle = make(HelpCircleIcon)
export const ListChecks = make(CheckListIcon)
export const ListTodo = make(Task01Icon)
export const Loader2 = make(Loading03Icon)
export const Loader2Icon = Loader2
export const MinusCircle = make(MinusSignCircleIcon)
export const Minus = make(MinusSignIcon)
export const Shield = make(Shield01Icon)
export const ShieldAlert = make(AlertDiamondIcon)
export const X = make(Cancel01Icon)
export const XIcon = X
export const XCircle = make(CancelCircleIcon)
export const XSquare = make(CancelSquareIcon)
export const Square = make(Square01Icon)
export const Star = make(StarIcon)
export const ThumbsUp = make(ThumbsUpIcon)
export const Zap = make(SparklesIcon)
export const Sparkles = make(SparklesIcon)

// — Arrows / chevrons —
export const ArrowDown = make(ArrowDown01Icon)
export const ArrowDownToLine = make(ArrowDown01Icon)
export const ArrowLeft = make(ArrowLeft01Icon)
export const ArrowRight = make(ArrowRight01Icon)
export const ArrowUp = make(ArrowUp01Icon)
export const ArrowUpToLine = make(ArrowUp01Icon)
export const ArrowUpCircle = make(ArrowUp01Icon)
export const ArrowUpDown = make(ArrowDownDoubleIcon)
export const ChevronDown = make(ArrowDown01Icon)
export const ChevronDownIcon = ChevronDown
export const ChevronUp = make(ArrowUp01Icon)
export const ChevronUpIcon = ChevronUp
export const ChevronLeftIcon = make(ArrowLeft01Icon)
export const ChevronRight = make(ArrowRight01Icon)
export const ChevronRightIcon = ChevronRight
export const ChevronsUpDown = make(ArrowDownDoubleIcon)
export const ChevronsDownUp = make(ArrowDownDoubleIcon)

// — Files / folders —
export const Archive = make(ArchiveIcon)
export const ArchiveRestore = make(Archive02Icon)
export const FileCode = make(CodeIcon)
export const FileCode2 = make(CodeIcon)
export const FileIcon = make(FileEmptyIcon)
export const FileJson = make(FileEditIcon)
export const FileText = make(FileEditIcon)
export const Folder = make(Folder01Icon)
export const FolderIcon = Folder
export const FolderGit = make(FolderLibraryIcon)
export const FolderGit2 = make(FolderLibraryIcon)
export const FolderOpen = make(FolderEditIcon)
export const FolderPlus = make(FolderAddIcon)

// — Git —
export const GitBranch = make(GitBranchIcon)
export const GitBranchPlus = make(GitForkIcon)
export const GitCommitHorizontal = make(GitCommitIcon)
export const GitMerge = make(GitMergeIcon)
export const GitPullRequest = make(GitPullRequestIcon)
export const GitPullRequestArrow = make(GitPullRequestClosedIcon)
export const Github = make(Github01Icon)

// — Editing / actions —
export const Bookmark = make(Bookmark01Icon)
export const BookmarkPlus = make(BookmarkAdd01Icon)
export const Copy = make(Copy01Icon)
export const Delete = make(Delete01Icon)
export const Download = make(Download01Icon)
export const Edit = make(Edit01Icon)
export const Pencil = make(PencilEdit01Icon)
export const PenLine = make(PencilEdit02Icon)
export const Save = make(Edit02Icon)
export const Send = make(Sent02Icon)
export const Tag = make(Tag01Icon)
export const Trash2 = make(RestoreBinIcon)
export const Undo2 = make(Undo02Icon)
export const Upload = make(Upload01Icon)
export const Paperclip = make(AttachmentIcon)
export const Wand2 = make(MagicWand01Icon)

// — Layout / nav —
export const BarChart3 = make(BarChartIcon)
export const BellDot = make(BellDotIcon)
export const Blocks = make(PuzzleIcon)
export const Bot = make(BotIcon)
export const Brain = make(BrainIcon)
export const Briefcase = make(Briefcase01Icon)
export const Code = make(CodeIcon)
export const Columns2 = make(SidebarLeft01Icon)
export const Command = make(CommandIcon)
export const Ellipsis = make(MoreHorizontalIcon)
export const ExternalLink = make(Link02Icon)
export const Eye = make(EyeIcon)
export const EyeOff = make(ViewOffIcon)
export const FlaskConical = make(TestTubeIcon)
export const Globe = make(GlobeIcon)
export const GripVertical = make(MoreHorizontalIcon)
export const GripVerticalIcon = GripVertical
export const Hammer = make(WrenchIcon)
export const Heart = make(StarIcon)
export const Home = make(Home01Icon)
export const Image = make(HugeImageIcon)
export const ImageIcon = Image
export const Keyboard = make(KeyboardIcon)
export const KeyRound = make(KeyboardIcon)
export const Layers = make(Layers01Icon)
export const LayoutDashboard = make(DashboardSquare01Icon)
export const Lightbulb = make(IdeaIcon)
export const Link2 = make(Link02Icon)
export const List = make(ListSettingIcon)
export const LogIn = make(Login03Icon)
export const Maximize = make(Maximize02Icon)
export const Menu = make(Menu02Icon)
export const MessageCircle = make(Chat01Icon)
export const MessageSquare = make(Chat01Icon)
export const MessageSquarePlus = make(MessageEditIcon)
export const MessagesSquare = make(Chat01Icon)
export const Minimize = make(Minimize02Icon)
export const MoreHorizontal = make(MoreHorizontalIcon)
export const Package = make(PackageIcon)
export const Palette = make(PaintBoardIcon)
export const PanelBottom = make(SidebarBottomIcon)
export const PanelLeft = make(SidebarLeft01Icon)
export const PanelLeftIcon = PanelLeft
export const PanelLeftClose = make(SidebarLeft01Icon)
export const PanelRight = make(SidebarRight01Icon)
export const PanelRightDashed = make(SidebarRight01Icon)
export const Play = make(PlayIcon)
export const Plug = make(Plug01Icon)
export const Plus = make(Add01Icon)
export const Puzzle = make(PuzzleIcon)
export const RefreshCw = make(Refresh01Icon)
export const RotateCcw = make(RotateLeft01Icon)
export const RotateCw = make(RotateRight01Icon)
export const Rows3 = make(SidebarBottomIcon)
export const Search = make(Search01Icon)
export const SearchIcon = Search
export const Settings = make(Settings02Icon)
export const Table = make(SidebarBottomIcon)
export const Target = make(Target01Icon)
export const Terminal = make(TerminalIcon)
export const Users = make(UserMultipleIcon)
export const Wrench = make(WrenchIcon)
export const Clock = make(Clock01Icon)
export const Clock3 = make(Clock01Icon)
export const ClipboardList = make(ClipboardIcon)

// — Custom backend logos (re-exported) —
export { ClaudeIcon } from './ClaudeIcon'
export { CodexIcon } from './CodexIcon'
export { CursorIcon } from './CursorIcon'
export { LinearIcon } from './LinearIcon'
export { OpenCodeIcon } from './OpenCodeIcon'
