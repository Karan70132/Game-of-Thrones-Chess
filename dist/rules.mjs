// Generated from original/chess_arsenal.cpp by scripts/build_rules.py.
export const validators = {
P(Board,source_rank,source_file,destined_rank,destined_file) {
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	if ( Math.abs(destined_file-source_file) > 1 ) return false;
	if ( Math.abs(destined_rank-source_rank) > 2 ) return false;
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	if ( color == 'W' )
	{	
		if( destined_rank <= source_rank ) return false;
		
		
		if( Math.abs(destined_file-source_file) == 1 ) 
		{
			if(Is_empty)return false;
			if(delta !=1 )return false;
			return true;
		}
		else 
		{
			if(!Is_empty || delta >2 )return false;
			if( source_rank == 1 ) 
			{
				if( delta == 2 )
				{
					let In_between = Board[(destined_rank-1)*8+(destined_file)];
					if(In_between != 0 )return false;
				}
				return true;
			}
			else{ 
				if(delta !=1 )return false;
				return true;
			}
		}
		
		
	}
	
	if(destined_rank >= source_rank ) return false;
	
	if( Math.abs(destined_file-source_file) == 1 ) 
	{
		if(Is_empty)return false;
		if( delta !=-1 )return false;
		return true;
	}
	else 
	{
		if(!Is_empty || delta <-2 )return false;
		if( source_rank == 6 ) 
		{
			if(delta== -2 )
			{
				let In_between = Board[(destined_rank+1)*8+(destined_file)];
				if(In_between != 0 )return false;
			}
			return true;
		}
		else{ 
			if(delta !=-1 )return false;
			return true;
		}
	}
	return false;},
N(Board,source_rank,source_file,destined_rank,destined_file) {
	
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	let beta = destined_file - source_file ;
	
	if ( Math.abs(delta) + Math.abs(beta) !=3 ) return false;
	 
	if ( delta ==0 || beta == 0 ) return false;
	
	return true;},
R(Board,source_rank,source_file,destined_rank,destined_file) {
	
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	let beta = destined_file - source_file ;
	
	if (delta !=0 && beta!=0) return false;
	
	let rank_tr = ( delta > 0)? 1 : ( delta ==0 ) ? 0 : -1 ; 
	let file_tr = ( beta > 0 )? 1 : ( beta == 0 ) ? 0 : -1 ; 
	
	let row = source_rank + rank_tr , col = source_file + file_tr ;
	while( row != destined_rank || col != destined_file ){
		if( Board[(row)*8+(col)] != 0 )
		{
			return  false;
		}
		row += rank_tr ;
		col += file_tr ;
	}
	
	return true;},
B(Board,source_rank,source_file,destined_rank,destined_file) {
	
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	let beta = destined_file - source_file ;
	
	if (Math.abs(delta) != Math.abs(beta) )return false;
	
	let rank_tr = ( delta > 0 ) ? 1 : -1 ;  
	let file_tr = ( beta > 0  ) ? 1 : -1 ;  
	
	let row = source_rank + rank_tr , col = source_file + file_tr ;
	while( row!= destined_rank || col!= destined_file ){
		if( Board[(row)*8+(col)] != 0 )
		{
			return false;
		}
		row += rank_tr ;
		col += file_tr ;
	}
	
	return true;},
Q(Board,source_rank,source_file,destined_rank,destined_file) {
	
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	let beta = destined_file - source_file ;
	
	if (Math.abs(delta) != Math.abs(beta) && delta !=0 && beta !=0 )return false;
	
	let rank_tr = ( delta > 0)? 1 : ( delta ==0 ) ? 0 : -1 ; 
	let file_tr = ( beta > 0 )? 1 : ( beta == 0 ) ? 0 : -1 ; 
	
	let row = source_rank + rank_tr , col = source_file + file_tr ;
	while( row!= destined_rank || col!= destined_file ){
		if( Board[(row)*8+(col)] != 0 )
		{
			return false;
		}
		row += rank_tr ;
		col += file_tr ;
	}
	
	return true;},
K(Board,source_rank,source_file,destined_rank,destined_file) {
	
	let color = side(Board[source_rank*8+source_file]) ; 
	
	
	let destined_position = Board[(destined_rank)*8+(destined_file)] ;
	
	
	let Is_empty = true ;
	if( destined_position != 0)
	{
		if(color == side(destined_position)) return false;
		Is_empty = false;
	}
	
	let delta = destined_rank - source_rank ;
	let beta = destined_file - source_file ;
	
	if ( Math.abs(delta) + Math.abs(beta) > 2 ) return false;
	
	if(Math.abs(delta) == 0 && Math.abs(delta) + Math.abs(beta) == 2 )  return false;
	return true;},
}
export const side = p => p===0 ? null : p===p.toUpperCase() ? 'W' : 'B';