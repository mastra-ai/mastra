import { Button } from '@/components/ui/button';

interface WorkflowsTableEmptyStateProps {
  handleCreateWorkflow: () => void;
}

export const WorkflowsTableEmptyState = ({ handleCreateWorkflow }: WorkflowsTableEmptyStateProps) => {
  return (
    <div className="grid h-[80vh] w-full place-items-center">
      <div className="flex flex-col gap-3">
        <svg width="335" height="240" viewBox="0 0 335 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.8">
            <g opacity="0.1" filter="url(#filter0_d_1_33)">
              <circle cx="166.898" cy="116.554" r="88.5541" fill="#D9D9D9" fillOpacity="0.1" />
              <circle
                cx="166.898"
                cy="116.554"
                r="87.5541"
                stroke="url(#paint0_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
              />
            </g>
            <g opacity="0.4" filter="url(#filter1_d_1_33)">
              <circle cx="166.898" cy="116.555" r="69.8972" fill="#D9D9D9" fillOpacity="0.06" />
              <circle
                cx="166.898"
                cy="116.555"
                r="68.8972"
                stroke="url(#paint1_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
              />
            </g>
            <g opacity="0.7" filter="url(#filter2_d_1_33)">
              <circle cx="166.898" cy="116.555" r="49.9197" fill="#D9D9D9" fillOpacity="0.07" />
              <circle
                cx="166.898"
                cy="116.555"
                r="48.9197"
                stroke="url(#paint2_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
              />
            </g>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M157.991 94.0266C157.991 92.5125 159.218 91.2851 160.733 91.2851H174.097C175.611 91.2851 176.839 92.5125 176.839 94.0266V103.108C176.839 104.622 175.611 105.849 174.097 105.849H170.842V114.719L173.697 122.54C173.284 122.435 172.849 122.329 172.395 122.219L172.123 122.154C170.779 121.83 169.182 121.447 167.918 120.945C167.759 120.882 167.59 120.811 167.415 120.732C167.24 120.811 167.071 120.882 166.912 120.945C165.648 121.447 164.051 121.83 162.707 122.154L162.435 122.219C161.981 122.329 161.546 122.435 161.132 122.54L163.988 114.719V105.849H160.733C159.218 105.849 157.991 104.622 157.991 103.108V94.0266ZM161.132 122.54C161.132 122.54 161.132 122.54 161.132 122.54L158.78 128.981H160.39C161.904 128.981 163.131 130.208 163.131 131.722V140.803C163.131 142.317 161.904 143.545 160.39 143.545H147.025C145.511 143.545 144.284 142.317 144.284 140.803V131.722C144.284 130.208 145.511 128.981 147.025 128.981H149.728C149.837 127.719 149.986 126.395 150.193 125.151C150.445 123.643 150.83 121.933 151.499 120.594C152.543 118.507 154.664 117.488 156.041 116.947C157.586 116.339 159.376 115.906 160.829 115.556C162.182 115.23 163.221 114.978 163.988 114.719L161.132 122.54ZM158.78 128.981L161.132 122.54C160.141 122.792 159.273 123.04 158.549 123.325C157.924 123.571 157.65 123.753 157.558 123.818C157.38 124.251 157.156 125.063 156.954 126.278C156.813 127.121 156.701 128.043 156.61 128.981H158.78ZM173.697 122.54L170.842 114.719C171.609 114.978 172.648 115.23 174.001 115.556C175.454 115.906 177.244 116.339 178.789 116.947C180.166 117.488 182.287 118.507 183.331 120.594C184 121.933 184.385 123.643 184.637 125.151C184.844 126.395 184.993 127.719 185.101 128.981H187.805C189.319 128.981 190.546 130.208 190.546 131.722V140.803C190.546 142.317 189.319 143.545 187.805 143.545H174.44C172.926 143.545 171.699 142.317 171.699 140.803V131.722C171.699 130.208 172.926 128.981 174.44 128.981H176.05L173.697 122.54ZM173.697 122.54L176.05 128.981H178.22C178.129 128.043 178.017 127.121 177.876 126.278C177.674 125.063 177.45 124.251 177.272 123.818C177.18 123.753 176.906 123.571 176.281 123.325C175.557 123.04 174.689 122.792 173.697 122.54Z"
              fill="white"
            />
            <g filter="url(#filter3_bd_1_33)">
              <circle
                cx="252.32"
                cy="116.555"
                r="27.4159"
                fill="#D9D9D9"
                fillOpacity="0.07"
                shapeRendering="crispEdges"
              />
              <circle
                cx="252.32"
                cy="116.555"
                r="26.4159"
                stroke="url(#paint3_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
                shapeRendering="crispEdges"
              />
            </g>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M250.2 110.358C249.85 110.358 249.567 110.65 249.567 111.011V125.483C249.567 125.843 249.85 126.136 250.2 126.136H252.734C253.084 126.136 253.368 125.843 253.368 125.483V122.872C253.368 122.511 253.652 122.219 254.001 122.219H257.803C258.153 122.219 258.436 122.511 258.436 122.872V125.483C258.436 125.843 258.72 126.136 259.07 126.136H261.604C261.954 126.136 262.237 125.843 262.237 125.483V111.011C262.237 110.65 261.954 110.358 261.604 110.358H250.2ZM259.703 115.691C259.003 115.691 258.436 116.276 258.436 116.997V117.78C258.436 118.068 258.663 118.302 258.943 118.302H260.463C260.743 118.302 260.97 118.068 260.97 117.78V116.997C260.97 116.276 260.403 115.691 259.703 115.691ZM258.436 113.08C258.436 112.359 259.003 111.774 259.703 111.774C260.403 111.774 260.97 112.359 260.97 113.08V113.863C260.97 114.152 260.743 114.386 260.463 114.386H258.943C258.663 114.386 258.436 114.152 258.436 113.863V113.08ZM255.902 111.774C255.202 111.774 254.635 112.359 254.635 113.08V113.863C254.635 114.152 254.862 114.386 255.142 114.386H256.662C256.942 114.386 257.169 114.152 257.169 113.863V113.08C257.169 112.359 256.602 111.774 255.902 111.774ZM254.635 116.997C254.635 116.276 255.202 115.691 255.902 115.691C256.602 115.691 257.169 116.276 257.169 116.997V117.78C257.169 118.068 256.942 118.302 256.662 118.302H255.142C254.862 118.302 254.635 118.068 254.635 117.78V116.997ZM252.101 115.691C251.401 115.691 250.834 116.276 250.834 116.997V117.78C250.834 118.068 251.061 118.302 251.341 118.302H252.861C253.141 118.302 253.368 118.068 253.368 117.78V116.997C253.368 116.276 252.801 115.691 252.101 115.691ZM250.834 113.08C250.834 112.359 251.401 111.774 252.101 111.774C252.801 111.774 253.368 112.359 253.368 113.08V113.863C253.368 114.152 253.141 114.386 252.861 114.386H251.341C251.061 114.386 250.834 114.152 250.834 113.863V113.08Z"
              fill="url(#paint4_linear_1_33)"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M242.403 114.009C242.403 113.648 242.687 113.356 243.037 113.356H247.678C248.028 113.356 248.312 113.648 248.312 114.009V125.484C248.312 125.844 248.028 126.137 247.678 126.137H243.037C242.687 126.137 242.403 125.844 242.403 125.484V114.009ZM245.359 114.844C244.659 114.844 244.092 115.429 244.092 116.15V116.933C244.092 117.221 244.319 117.455 244.599 117.455H246.119C246.399 117.455 246.626 117.221 246.626 116.933V116.15C246.626 115.429 246.059 114.844 245.359 114.844ZM244.092 119.775C244.092 119.054 244.659 118.469 245.359 118.469C246.059 118.469 246.626 119.054 246.626 119.775V120.558C246.626 120.847 246.399 121.081 246.119 121.081H244.599C244.319 121.081 244.092 120.847 244.092 120.558V119.775Z"
              fill="url(#paint5_linear_1_33)"
            />
            <path
              d="M249.529 108.389C249.529 107.607 250.164 106.972 250.946 106.972H260.821C261.603 106.972 262.238 107.607 262.238 108.389V108.727C262.238 109.118 261.92 109.435 261.529 109.435H250.238C249.847 109.435 249.529 109.118 249.529 108.727V108.389Z"
              fill="url(#paint6_linear_1_33)"
            />
            <g filter="url(#filter4_bd_1_33)">
              <circle
                cx="82.8053"
                cy="116.555"
                r="27.4159"
                fill="#D9D9D9"
                fillOpacity="0.07"
                shapeRendering="crispEdges"
              />
              <circle
                cx="82.8053"
                cy="116.555"
                r="26.4159"
                stroke="url(#paint7_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
                shapeRendering="crispEdges"
              />
            </g>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M87.9029 118.688L88.1563 118.853L89.446 119.742C90.4714 120.449 91.1112 121.585 91.192 122.818L91.2006 123.084V123.49C91.2006 124.824 90.1703 125.918 88.8618 126.019L88.6634 126.027H81.5605C80.2259 126.027 79.132 124.996 79.0309 123.688L79.0233 123.49V123.084C79.0233 121.838 79.5947 120.667 80.5642 119.9L80.7779 119.742L82.0676 118.853C83.8171 117.646 86.1044 117.592 87.9029 118.688ZM81.1376 115.982L81.3911 116.147L82.6393 117.006C82.2073 117.175 81.7888 117.391 81.3911 117.653L79.4967 118.901C78.3565 119.652 77.6702 120.925 77.6702 122.291V123.065C77.6702 123.151 77.6739 123.236 77.6811 123.32L74.7953 123.321C73.4607 123.321 72.3668 122.29 72.2657 120.982L72.2581 120.784V120.378C72.2581 119.132 72.8295 117.961 73.799 117.194L74.0127 117.036L75.3024 116.147C77.0519 114.94 79.3392 114.886 81.1376 115.982ZM85.112 109.79C86.9801 109.79 88.4946 111.305 88.4946 113.173C88.4946 115.041 86.9801 116.556 85.112 116.556C83.2438 116.556 81.7293 115.041 81.7293 113.173C81.7293 111.305 83.2438 109.79 85.112 109.79ZM78.3467 107.084C80.2149 107.084 81.7293 108.599 81.7293 110.467C81.7293 112.335 80.2149 113.849 78.3467 113.849C76.4786 113.849 74.9641 112.335 74.9641 110.467C74.9641 108.599 76.4786 107.084 78.3467 107.084Z"
              fill="url(#paint8_linear_1_33)"
            />
            <g filter="url(#filter5_bd_1_33)">
              <circle
                cx="25.2487"
                cy="116.555"
                r="21.2487"
                fill="#D9D9D9"
                fillOpacity="0.05"
                shapeRendering="crispEdges"
              />
              <circle
                cx="25.2487"
                cy="116.555"
                r="20.2487"
                stroke="url(#paint9_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
                shapeRendering="crispEdges"
              />
            </g>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M24.101 110.127V115.406C24.101 116.122 24.6471 116.711 25.3455 116.777L25.4781 116.784H30.7573V121.145C30.7573 122.159 29.9353 122.981 28.9211 122.981H21.5761C20.562 122.981 19.7399 122.159 19.7399 121.145V111.963C19.7399 110.949 20.562 110.127 21.5761 110.127H24.101ZM25.2486 110.127L30.7573 115.664H26.1667C25.6597 115.664 25.2486 115.253 25.2486 114.746V110.127Z"
              fill="url(#paint10_linear_1_33)"
            />
            <g filter="url(#filter6_bd_1_33)">
              <circle
                cx="309.877"
                cy="116.555"
                r="21.2487"
                fill="#D9D9D9"
                fillOpacity="0.05"
                shapeRendering="crispEdges"
              />
              <circle
                cx="309.877"
                cy="116.555"
                r="20.2487"
                stroke="url(#paint11_linear_1_33)"
                strokeOpacity="0.6"
                strokeWidth="2"
                shapeRendering="crispEdges"
              />
            </g>
            <path
              d="M309.854 111.354L307.201 113.741C306.76 114.137 306.675 114.85 307.009 115.358C307.363 115.9 308.051 116.007 308.525 115.596L311.246 113.245C311.438 113.08 311.712 113.117 311.862 113.33C312.013 113.543 311.978 113.848 311.786 114.015L311.213 114.508L316.069 119.478H316.168C316.894 119.478 317.484 118.824 317.484 118.017V114.119C317.484 113.312 316.894 112.657 316.168 112.657H315.132H315.022H315.003L314.896 112.581L312.906 111.165C312.487 110.866 311.997 110.708 311.498 110.708C310.901 110.708 310.32 110.936 309.854 111.354ZM310.479 115.142L309.062 116.366C308.199 117.115 306.946 116.92 306.3 115.934C305.691 115.005 305.845 113.708 306.648 112.986L308.928 110.936C308.61 110.787 308.267 110.711 307.919 110.711C307.404 110.708 306.902 110.879 306.472 111.195L304.499 112.657H303.585C302.859 112.657 302.27 113.312 302.27 114.119V118.017C302.27 118.824 302.859 119.478 303.585 119.478H305.272L307.777 122.018C308.314 122.563 309.144 122.52 309.635 121.924C309.785 121.738 309.887 121.522 309.939 121.296L310.405 121.771C310.939 122.316 311.772 122.277 312.263 121.683C312.386 121.534 312.476 121.36 312.534 121.181C313.065 121.576 313.789 121.494 314.236 120.952C314.726 120.358 314.69 119.433 314.156 118.888L310.479 115.142Z"
              fill="url(#paint12_linear_1_33)"
            />
          </g>
          <defs>
            <filter
              id="filter0_d_1_33"
              x="47.4994"
              y="0.240271"
              width="238.797"
              height="238.797"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feMorphology radius="7.7111" operator="dilate" in="SourceAlpha" result="effect1_dropShadow_1_33" />
              <feOffset dy="3.08444" />
              <feGaussianBlur stdDeviation="11.5666" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0.2 0" />
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter1_d_1_33"
              x="66.1564"
              y="18.8981"
              width="201.483"
              height="201.483"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feMorphology radius="7.7111" operator="dilate" in="SourceAlpha" result="effect1_dropShadow_1_33" />
              <feOffset dy="3.08444" />
              <feGaussianBlur stdDeviation="11.5666" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0.2 0" />
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter2_d_1_33"
              x="86.1336"
              y="38.8749"
              width="161.528"
              height="161.528"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feMorphology radius="7.7111" operator="dilate" in="SourceAlpha" result="effect1_dropShadow_1_33" />
              <feOffset dy="3.08444" />
              <feGaussianBlur stdDeviation="11.5666" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0 0.0708333 0 0 0 0.2 0" />
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter3_bd_1_33"
              x="221.049"
              y="85.2832"
              width="62.5429"
              height="64.8562"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feGaussianBlur in="BackgroundImageFix" stdDeviation="1.92777" />
              <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_1_33" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="3.08444" />
              <feGaussianBlur stdDeviation="1.54222" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
              <feBlend mode="normal" in2="effect1_backgroundBlur_1_33" result="effect2_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter4_bd_1_33"
              x="51.5338"
              y="85.2832"
              width="62.5429"
              height="64.8562"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feGaussianBlur in="BackgroundImageFix" stdDeviation="1.92777" />
              <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_1_33" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="3.08444" />
              <feGaussianBlur stdDeviation="1.54222" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
              <feBlend mode="normal" in2="effect1_backgroundBlur_1_33" result="effect2_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter5_bd_1_33"
              x="-0.0144911"
              y="91.2914"
              width="50.5263"
              height="52.935"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feGaussianBlur in="BackgroundImageFix" stdDeviation="2.00723" />
              <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_1_33" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="3.21157" />
              <feGaussianBlur stdDeviation="1.60578" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
              <feBlend mode="normal" in2="effect1_backgroundBlur_1_33" result="effect2_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_1_33" result="shape" />
            </filter>
            <filter
              id="filter6_bd_1_33"
              x="284.614"
              y="91.2914"
              width="50.5263"
              height="52.935"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feGaussianBlur in="BackgroundImageFix" stdDeviation="2.00723" />
              <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_1_33" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="3.21157" />
              <feGaussianBlur stdDeviation="1.60578" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
              <feBlend mode="normal" in2="effect1_backgroundBlur_1_33" result="effect2_dropShadow_1_33" />
              <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_1_33" result="shape" />
            </filter>
            <linearGradient
              id="paint0_linear_1_33"
              x1="293.639"
              y1="-99.7101"
              x2="43.6772"
              y2="334.925"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_1_33"
              x1="266.937"
              y1="-54.1458"
              x2="69.6378"
              y2="288.919"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_1_33"
              x1="238.344"
              y1="-5.35789"
              x2="97.4358"
              y2="239.654"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint3_linear_1_33"
              x1="291.559"
              y1="49.6003"
              x2="214.172"
              y2="184.161"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint4_linear_1_33"
              x1="275.13"
              y1="81.699"
              x2="213.758"
              y2="175.837"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint5_linear_1_33"
              x1="275.13"
              y1="81.699"
              x2="213.758"
              y2="175.837"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint6_linear_1_33"
              x1="275.13"
              y1="81.699"
              x2="213.758"
              y2="175.837"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint7_linear_1_33"
              x1="122.044"
              y1="49.6003"
              x2="44.6568"
              y2="184.161"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint8_linear_1_33"
              x1="105.443"
              y1="83.8374"
              x2="54.5788"
              y2="170.21"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint9_linear_1_33"
              x1="55.6604"
              y1="64.6616"
              x2="-4.31833"
              y2="168.953"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint10_linear_1_33"
              x1="37.8397"
              y1="96.2075"
              x2="14.7979"
              y2="139.598"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint11_linear_1_33"
              x1="340.288"
              y1="64.6616"
              x2="280.31"
              y2="168.953"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint12_linear_1_33"
              x1="328.694"
              y1="81.2862"
              x2="290.131"
              y2="158.636"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5F5F5" />
              <stop offset="1" stopColor="#F5F5F5" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <p className="text-center font-medium">No workflow</p>
        <Button
          onClick={() => handleCreateWorkflow()}
          type="button"
          className="hover:bg-hover-color mx-auto flex w-fit items-center rounded bg-[#2f2f2f] px-3 py-2 text-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.09)]"
        >
          Create new workflow
        </Button>
      </div>
    </div>
  );
};
