import logo from '@/icons/logo.svg'
import search from '@/icons/search.svg'
import Image from 'next/image'
import Link from 'next/link'

export const Sidebar = () => {
    return <div className="relative z-20 h-full text-light-text">
        <div className="bg-main-bg h-full w-full p-4">
            <div className='flex items-center justify-between'>
            <div className='flex gap-2 items-center'>
            <Image src={logo} alt='strematic logo' width={21} height={21} className='w-[1.25rem] h-[1.25rem]' priority />
            <p className='text-medium text-sm text-light-text'>Streamatic</p>
            </div>

            <button>
             <Image src={search} alt='search ' width={21} height={21} className='w-[0.875rem] h-[0.875rem]' priority />
            </button>
            </div>
               <div className='flex flex-col gap-0.5 text-light-text'>
                <Link href={'/workflow'}>Workflow</Link>
                  <Link href={'/logs'}>Logs</Link>
                    <Link href={'/records'}>Record</Link>
        </div>
        </div>
     
    </div>
}